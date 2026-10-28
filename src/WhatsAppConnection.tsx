// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { canStartEmbeddedSignupCompletion, embeddedSignupCompletionPayload, embeddedSignupRecoveryOutcome, emptyEmbeddedSignupPending, pendingSignupStorageKey, savePendingSignup, loadPendingSignup } from "./lib/embeddedSignupRecovery";
import { embeddedSignupLoginOptions, partnerCompletionOutcome } from "./lib/embeddedSignupProvider";

let facebookSdkPromise;

function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve(window.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("facebook-jssdk");
    const initialise = () => {
      if (!window.FB) return reject(new Error("Facebook login could not be loaded."));
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v26.0" });
      resolve(window.FB);
    };

    if (existing) {
      existing.addEventListener("load", initialise, { once: true });
      window.setTimeout(() => window.FB && initialise(), 0);
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onload = initialise;
    script.onerror = () => reject(new Error("Facebook login could not be loaded."));
    document.head.appendChild(script);
  });

  return facebookSdkPromise;
}

export function WhatsAppConnection({ apiFetch, API, user, customer, onWorkspaceUpdated, onConnectionStateChange }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const pending = useRef(emptyEmbeddedSignupPending());
  const completionStarted = useRef(false);
  const mounted = useRef(true);
  const workspaceRef=useRef(customer?.id);workspaceRef.current=customer?.id;
  const refreshSequence=useRef(0);
  const probeRunning=useRef(false);
  const recoveryDeadline=useRef(0);
  const storageKey=pendingSignupStorageKey(customer?.id,user?.id);
  const persistPending=()=>savePendingSignup(window.sessionStorage,storageKey,pending.current);
  useEffect(()=>{
    pending.current=loadPendingSignup(window.sessionStorage,storageKey)||emptyEmbeddedSignupPending();
    completionStarted.current=false;recoveryDeadline.current=0;setContext(null);setPhase(pending.current.completionSubmitted?'in_progress':'idle');
    return()=>{refreshSequence.current++;};
  },[storageKey]);
  const onWorkspaceUpdatedRef = useRef(onWorkspaceUpdated);

  const metaAppId = import.meta.env.VITE_META_APP_ID;
  const embeddedSignupConfigId = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID;
  const configured = Boolean(metaAppId && embeddedSignupConfigId);
  const connection = context?.whatsapp_connection || null;
  const onboarding = context?.onboarding || {};
  const role = context?.role || customer?.role || "member";
  const canManage = ["owner", "admin"].includes(role);
  const emailVerified = Boolean(onboarding.email_verified ?? user?.email_confirmed_at);
  const profileComplete = Boolean(onboarding.business_profile_complete);

  useEffect(() => { onWorkspaceUpdatedRef.current = onWorkspaceUpdated; }, [onWorkspaceUpdated]);

  useEffect(() => {
    onConnectionStateChange?.({ phase, message });
  }, [message, onConnectionStateChange, phase]);

  const refresh = useCallback(async () => {
    const workspace=customer?.id,sequence=++refreshSequence.current;
    setLoading(true);
    try {
      const response = await apiFetch(`${API}/workspace`);
      if (!response.ok) throw new Error("We could not check the WhatsApp connection. Please try again.");
      let latest = await response.json();
      if (!mounted.current || workspaceRef.current!==workspace || sequence!==refreshSequence.current) return;
      const row=latest.whatsapp_connection;
      if(row?.id && row.status!=='connected' && ['owner','admin'].includes(latest.role) && !probeRunning.current){
        probeRunning.current=true;
        try {
          const checked=await apiFetch(`${API}/whatsapp-connections/${row.id}/provision/status`,{method:'POST'});
          const status=await checked.json();
          if(workspaceRef.current!==workspace || sequence!==refreshSequence.current)return;
          if(status.phase==='complete'){
            const confirmed=await apiFetch(`${API}/workspace`);latest=await confirmed.json();
          } else {setPhase(status.phase==='confirmation_required'?'confirmation_required':'in_progress');}
        }catch { /* Preserve the linked number while provider status is delayed. */ }
        finally{probeRunning.current=false;}
      }
      if (!mounted.current || workspaceRef.current!==workspace || sequence!==refreshSequence.current) return;
      setContext(latest);
      // A lost completion response must not hide a successfully finalized number.
      if (embeddedSignupRecoveryOutcome({ connection: latest?.whatsapp_connection }) === "complete") {
        pending.current = emptyEmbeddedSignupPending();
        persistPending();
        completionStarted.current = false;
        setPhase("complete");
        setMessage("WhatsApp is connected to this workspace.");
      }
      onWorkspaceUpdatedRef.current?.(latest.workspace);
      return latest;
    } catch (error) {
      if (mounted.current) setMessage(error?.message || "We could not load the WhatsApp connection.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [API, apiFetch, customer?.id, storageKey]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh, customer?.id, customer?.profile_completed_at, customer?.whatsapp_connected_at, customer?.onboarding_status]);

  const finishConnection = useCallback(async () => {
    const current = pending.current;
    const payload = embeddedSignupCompletionPayload(current);
    if (!payload || !canStartEmbeddedSignupCompletion(current, completionStarted.current)) return;

    const workspace=customer?.id;
    completionStarted.current = true;
    setPhase("validating");
    setMessage("ZedPing is securely confirming your WhatsApp number.");
    try {
      // Do not retain a one-time authorization code after handing it to the
      // server. Subsequent retries use the backend's server-only vault.
      pending.current.completionSubmitted = true;
      pending.current.code = null;
      persistPending();
      const response = await apiFetch(`${API}/whatsapp-connections/embedded-signup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const completed = await response.json();
      if(!mounted.current || workspaceRef.current!==workspace)return;
      const partnerOutcome = partnerCompletionOutcome(completed);
      if (partnerOutcome === "in_progress" || partnerOutcome === "confirmation_required") {
        completionStarted.current = false;
        setPhase(partnerOutcome);
        setMessage(partnerOutcome === "in_progress"
          ? "Your WhatsApp account is being activated. It is not ready to send messages yet."
          : "WhatsApp activation needs confirmation. Contact support before starting another setup.");
        await refresh();
        return;
      }
      const outcome = embeddedSignupRecoveryOutcome({ connection: completed?.connection });
      if (outcome !== "complete") throw new Error("WhatsApp provisioning needs attention. You can retry safely.");
      pending.current = emptyEmbeddedSignupPending();
      persistPending();
      setPhase("complete"); setMessage("WhatsApp is connected to this workspace.");
      await refresh();
    } catch (error) {
      if(!mounted.current || workspaceRef.current!==workspace)return;
      completionStarted.current = false;
      const errorMessage = error?.message || "We could not validate this WhatsApp connection.";
      let latest = null;
      try { latest = await refresh(); } catch {}
      const outcome = embeddedSignupRecoveryOutcome({ connection: latest?.whatsapp_connection, errorMessage });
      if (outcome === "complete") {
        pending.current = emptyEmbeddedSignupPending();
        persistPending();
        setPhase("complete");
        setMessage("WhatsApp is connected to this workspace.");
      } else if (outcome === "expired") {
        pending.current = emptyEmbeddedSignupPending();
        persistPending();
        setPhase("error");
        setMessage("This secure setup session has expired. Start again to connect WhatsApp.");
      } else if (outcome === "confirmation_required") {
        setPhase("confirmation_required");
        setMessage("WhatsApp registration needs confirmation. ZedPing will not retry registration automatically. Contact support if this status does not update.");
      } else if (outcome === "in_progress") {
        setPhase("in_progress");
        setMessage("WhatsApp activation is already in progress. This page will show the connection once it completes.");
      } else {
        setPhase("error");
        setMessage(errorMessage);
      }
    }
  }, [API, apiFetch, refresh, storageKey, customer?.id]);

  useEffect(()=>{
    if(!['validating','in_progress','confirmation_required','error'].includes(phase))return;
    if(!recoveryDeadline.current)recoveryDeadline.current=Date.now()+10*60*1000;
    let cancelled=false,timer;
    let checking=false;
    const check=async()=>{
      if(checking||cancelled)return;checking=true;
      window.clearTimeout(timer);
      const latest=await refresh();checking=false;
      if(cancelled || workspaceRef.current!==customer?.id || embeddedSignupRecoveryOutcome({connection:latest?.whatsapp_connection})==='complete')return;
      if(!latest?.whatsapp_connection && canStartEmbeddedSignupCompletion(pending.current,completionStarted.current))await finishConnection();
      if(!cancelled && Date.now()<recoveryDeadline.current)timer=window.setTimeout(check,5000);
      else if(!cancelled){setPhase('confirmation_required');setMessage('Activation is taking longer than expected. Your setup is saved. Use Check connection to check again, or contact ZedPing support.');}
    };
    timer=window.setTimeout(check,1000);
    const visible=()=>{if(document.visibilityState==='visible'&&!completionStarted.current)void check();};
    window.addEventListener('focus',visible);
    return()=>{cancelled=true;window.clearTimeout(timer);window.removeEventListener('focus',visible);};
  },[phase,refresh,finishConnection,customer?.id]);

  useEffect(() => {
    const isTrustedMetaOrigin = (origin) => {
      try {
        const url = new URL(origin);
        return url.protocol === "https:" && (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"));
      } catch {
        return false;
      }
    };

    const onMetaMessage = (event) => {
      if (!isTrustedMetaOrigin(event.origin)) return;

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== "object" || payload.type !== "WA_EMBEDDED_SIGNUP") return;

      const phoneNumberId = String(payload.data?.phone_number_id || "");
      const finishWabaId = String(payload.data?.waba_id || "");
      const finishReceived = ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "FINISH_ONLY_WABA"].includes(payload.event);
      console.info("[zedping_embedded_signup_event]", {
        event: typeof payload.event === "string" ? payload.event : "unknown",
        session_info_version: typeof (payload.version ?? payload.data?.version) === "string" || typeof (payload.version ?? payload.data?.version) === "number"
          ? String(payload.version ?? payload.data?.version)
          : null,
        has_phone_number_id: Boolean(phoneNumberId),
        has_waba_id: Boolean(payload.data?.waba_id),
        finish_received: finishReceived
      });
      if (!pending.current.session || workspaceRef.current!==customer?.id) return;
      if (finishReceived) {
        if (!/^[0-9]{5,32}$/.test(phoneNumberId)) {
          setPhase("in_progress");
          setMessage("WhatsApp setup has finished. Waiting for the selected number details; keep this page open while ZedPing checks your connection.");
          return;
        }
        pending.current.phoneNumberId = phoneNumberId;
        pending.current.finishWabaId = /^[0-9]{5,32}$/.test(finishWabaId) ? finishWabaId : null;
        finishConnection();
      } else if ((payload.event === "CANCEL" || payload.event === "ERROR") && pending.current.completionSubmitted) {
        setPhase("in_progress");void refresh();
      } else if (payload.event === "CANCEL") {
        completionStarted.current = false;
        pending.current = emptyEmbeddedSignupPending();
        persistPending();
        setPhase("idle");
        setMessage("WhatsApp setup was cancelled. You can try again whenever you are ready.");
      } else if (payload.event === "ERROR") {
        completionStarted.current = false;
        pending.current = emptyEmbeddedSignupPending();
        persistPending();
        setPhase("error");
        setMessage("Meta could not complete the WhatsApp setup. No connection was created. Please try again.");
      }
    };
    window.addEventListener("message", onMetaMessage);
    return () => window.removeEventListener("message", onMetaMessage);
  }, [finishConnection,customer?.id,refresh]);

  const start = async () => {
    if (pending.current.completionSubmitted){await finishConnection();return;}
    if (!canManage || !emailVerified || !profileComplete || connection || !configured) return;
    setMessage("");
    setPhase("preparing");

    try {
      recoveryDeadline.current=0;
      completionStarted.current = false;
      pending.current = emptyEmbeddedSignupPending();
      persistPending();
      const startWorkspace=customer?.id;
      const prepared = await apiFetch(`${API}/whatsapp-connections/embedded-signup/prepare`, { method: "POST" });
      const session = await prepared.json();
      if(workspaceRef.current!==startWorkspace || !mounted.current)return;
      pending.current.session = session;
      const loginOptions = embeddedSignupLoginOptions(embeddedSignupConfigId, pending.current.session);

      const FB = await loadFacebookSdk(metaAppId);
      if(workspaceRef.current!==startWorkspace || pending.current.session!==session)return;
      setPhase("meta");
      setMessage("Continue in the Meta window to select or create your WhatsApp Business account.");
      FB.login((response) => {
        if(!mounted.current || workspaceRef.current!==startWorkspace || pending.current.session!==session)return;
        const code = response?.authResponse?.code;
        if (code) {
          pending.current.code = code;
          finishConnection();
          return;
        }

        // Meta can deliver the postMessage event just after its login callback.
        // Wait briefly so the event handler can capture the phone number first.
        window.setTimeout(() => {
          if (pending.current.session!==session || workspaceRef.current!==startWorkspace || pending.current.code || completionStarted.current || pending.current.completionSubmitted) return;
          pending.current = emptyEmbeddedSignupPending();
          setPhase("error");
          setMessage("Meta finished setup, but ZedPing did not receive the authorization result. No connection was created. Please try again.");
        }, 15000);
      }, loginOptions);
    } catch (error) {
      pending.current = emptyEmbeddedSignupPending();
      setPhase("error");
      setMessage(error?.message || "We could not start WhatsApp setup. Please try again.");
    }
  };

  const busy = ["preparing", "meta", "validating", "in_progress"].includes(phase);

  const retryProvisioning = async () => {
    if (!canManage || !connection?.id || connection?.provisioning_state !== "failed") return;
    setPhase("validating"); setMessage("Activating WhatsApp…");
    try { await apiFetch(`${API}/whatsapp-connections/${connection.id}/provision/retry`, { method: "POST" }); setPhase("complete"); setMessage("WhatsApp is connected to this workspace."); await refresh(); }
    catch (error) { setPhase("error"); setMessage(error?.message || "WhatsApp provisioning needs attention. Please try again."); await refresh(); }
  };

  if (loading && !context) return <div className="card" style={{ padding: 24, marginBottom: 16 }}><div className="spin" /></div>;

  const operational = connection?.status === "connected" && connection?.provisioning_state === "operational";
  const confirmationRequired = connection?.provisioning_state === "registration_confirmation_required" || phase === "confirmation_required";
  const provisioningInProgress = connection?.provisioning_state === "registering" || phase === "in_progress";
  const statusLabel = operational ? "Connected" : confirmationRequired ? "Registration confirmation needed" : provisioningInProgress ? "Activating WhatsApp..." : connection?.provisioning_state === "failed" ? "Connection needs attention" : connection ? "Number linked" : "Not connected";

  return (
    <section className="card-gold" style={{ padding: 24, marginBottom: 16 }} aria-labelledby="whatsapp-connection-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>WhatsApp connection</div>
          <h3 id="whatsapp-connection-heading" className="editorial" style={{ color: "var(--cream)", fontSize: 25, fontWeight: 600 }}>{connection ? "Your WhatsApp number" : "Connect your business number"}</h3>
        </div>
        <span className={operational ? "badge badge-green" : "badge badge-cream"}>{statusLabel}</span>
      </div>

      {connection ? (
        <div style={{ marginTop: 18, padding: 16, border: "1px solid var(--wire)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 600 }}>{connection.phone_number}</div>
          <div style={{ color: "var(--mist)", fontSize: 12, marginTop: 5 }}>
            {operational
              ? `Connected to ${customer?.business_name || "this workspace"}.`
              : confirmationRequired ? "WhatsApp registration needs confirmation before another attempt. ZedPing will not retry it automatically."
              : connection.provisioning_state === "failed" ? "Business account and phone were verified, but WhatsApp activation needs a safe retry."
              : provisioningInProgress ? "WhatsApp activation is in progress."
              : "This number is linked to your workspace."}
          </div>
          {connection.provisioning_state === "failed" && canManage && <button type="button" className="btn btn-wire" onClick={retryProvisioning} disabled={busy} style={{ marginTop: 12 }}>{busy ? "Retrying…" : "Retry activation"}</button>}
        </div>
      ) : (
        <>
          <p style={{ color: "var(--mist)", fontSize: 13, lineHeight: 1.6, marginTop: 14, maxWidth: 570 }}>
            Start here in ZedPing. Sign in to Meta to authorize your business and select your WhatsApp number. ZedPing handles the partner setup and connection checks automatically; a separate partner-portal login is not required.
          </p>

          {!profileComplete && <div role="status" style={{ marginTop: 14, color: "var(--gold2)", fontSize: 12 }}>Complete and save the business profile above before connecting WhatsApp.</div>}
          {!emailVerified && <div role="status" style={{ marginTop: 14, color: "var(--gold2)", fontSize: 12 }}>Verify your email before connecting WhatsApp.</div>}
          {!canManage && <div role="status" style={{ marginTop: 14, color: "var(--mist)", fontSize: 12 }}>Only workspace owners and admins can connect WhatsApp.</div>}
          {!configured && canManage && <div role="status" style={{ marginTop: 14, color: "var(--gold2)", fontSize: 12 }}>WhatsApp self-connection is being configured for this environment. Contact ZedPing support to connect your number.</div>}

          {canManage && emailVerified && profileComplete && configured && (
            <button className="btn btn-gold" type="button" onClick={start} disabled={busy} style={{ marginTop: 18 }}>
              {phase === "preparing" ? "Preparing secure setup…" : phase === "meta" ? "Waiting for Meta…" : phase === "validating" || phase === "in_progress" ? "Confirming connection…" : "Connect WhatsApp"}
            </button>
          )}
        </>
      )}

      {message && <div role={phase === "error" ? "alert" : "status"} aria-live="polite" style={{ marginTop: 14, color: phase === "error" ? "var(--error-text)" : phase === "complete" ? "var(--success-text)" : "var(--cream2)", fontSize: 12, lineHeight: 1.5 }}>{message}</div>}
      {["in_progress", "confirmation_required", "error"].includes(phase) && canManage && <button type="button" className="btn btn-wire" onClick={refresh} disabled={loading} style={{ marginTop: 12 }}>{loading ? "Checking connection…" : "Check connection"}</button>}
      {phase === "error" && pending.current.session && pending.current.phoneNumberId && canManage && !connection && <button type="button" className="btn btn-wire" onClick={finishConnection} style={{ marginTop: 12 }}>Resume secure setup</button>}
      {phase === "error" && !pending.current.session && !connection && canManage && emailVerified && profileComplete && configured && <button type="button" className="btn btn-wire" onClick={start} style={{ marginTop: 12 }}>Try again</button>}
    </section>
  );
}
