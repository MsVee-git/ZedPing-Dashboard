// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";

let facebookSdkPromise;

function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve(window.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("facebook-jssdk");
    const initialise = () => {
      if (!window.FB) return reject(new Error("Facebook login could not be loaded."));
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v18.0" });
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
  const pending = useRef({ session: null, code: null, phoneNumberId: null });
  const completionStarted = useRef(false);
  const mounted = useRef(true);
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
    setLoading(true);
    try {
      const response = await apiFetch(`${API}/workspace`);
      const latest = await response.json();
      if (!mounted.current) return;
      setContext(latest);
      onWorkspaceUpdatedRef.current?.(latest.workspace);
    } catch (error) {
      if (mounted.current) setMessage(error?.message || "We could not load the WhatsApp connection.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [API, apiFetch]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh, customer?.id, customer?.profile_completed_at, customer?.whatsapp_connected_at, customer?.onboarding_status]);

  const finishConnection = useCallback(async () => {
    const current = pending.current;
    if (!current.session || !current.code || !current.phoneNumberId || completionStarted.current) return;

    completionStarted.current = true;
    setPhase("validating");
    setMessage("ZedPing is securely confirming your WhatsApp number.");
    try {
      const response = await apiFetch(`${API}/whatsapp-connections/embedded-signup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: current.session.session_id,
          state: current.session.state,
          code: current.code,
          phone_number_id: current.phoneNumberId
        })
      });
      await response.json();
      pending.current = { session: null, code: null, phoneNumberId: null };
      setPhase("complete");
      setMessage("WhatsApp is connected to this workspace.");
      await refresh();
    } catch (error) {
      completionStarted.current = false;
      pending.current = { session: null, code: null, phoneNumberId: null };
      setPhase("error");
      setMessage(error?.message || "We could not validate this WhatsApp connection. Please try again.");
    }
  }, [API, apiFetch, refresh]);

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
      if (["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "FINISH_ONLY_WABA"].includes(payload.event)) {
        if (!/^[0-9]{5,32}$/.test(phoneNumberId)) {
          pending.current = { session: null, code: null, phoneNumberId: null };
          setPhase("error");
          setMessage("Meta finished setup, but ZedPing did not receive the WhatsApp phone identifier. No connection was created. Please try again.");
          return;
        }
        pending.current.phoneNumberId = phoneNumberId;
        finishConnection();
      } else if (payload.event === "CANCEL") {
        completionStarted.current = false;
        pending.current = { session: null, code: null, phoneNumberId: null };
        setPhase("idle");
        setMessage("WhatsApp setup was cancelled. You can try again whenever you are ready.");
      } else if (payload.event === "ERROR") {
        completionStarted.current = false;
        pending.current = { session: null, code: null, phoneNumberId: null };
        setPhase("error");
        setMessage("Meta could not complete the WhatsApp setup. No connection was created. Please try again.");
      }
    };
    window.addEventListener("message", onMetaMessage);
    return () => window.removeEventListener("message", onMetaMessage);
  }, [finishConnection]);

  const start = async () => {
    if (!canManage || !emailVerified || !profileComplete || connection || !configured) return;
    setMessage("");
    setPhase("preparing");

    try {
      completionStarted.current = false;
      pending.current = { session: null, code: null, phoneNumberId: null };
      const prepared = await apiFetch(`${API}/whatsapp-connections/embedded-signup/prepare`, { method: "POST" });
      pending.current.session = await prepared.json();

      const FB = await loadFacebookSdk(metaAppId);
      setPhase("meta");
      setMessage("Continue in the Meta window to select or create your WhatsApp Business account.");
      FB.login((response) => {
        const code = response?.authResponse?.code;
        if (code) {
          pending.current.code = code;
          finishConnection();
          return;
        }

        // Meta can deliver the postMessage event just after its login callback.
        // Wait briefly so the event handler can capture the phone number first.
        window.setTimeout(() => {
          if (!pending.current.session || pending.current.code || completionStarted.current) return;
          pending.current = { session: null, code: null, phoneNumberId: null };
          setPhase("error");
          setMessage("Meta finished setup, but ZedPing did not receive the authorization result. No connection was created. Please try again.");
        }, 1000);
      }, {
        config_id: embeddedSignupConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: 2, feature: "whatsapp_embedded_signup" }
      });
    } catch (error) {
      pending.current = { session: null, code: null, phoneNumberId: null };
      setPhase("error");
      setMessage(error?.message || "We could not start WhatsApp setup. Please try again.");
    }
  };

  const busy = ["preparing", "meta", "validating"].includes(phase);

  if (loading) return <div className="card" style={{ padding: 24, marginBottom: 16 }}><div className="spin" /></div>;

  const statusLabel = connection?.status === "connected" ? "Connected" : connection ? "Connection needs attention" : "Not connected";

  return (
    <section className="card-gold" style={{ padding: 24, marginBottom: 16 }} aria-labelledby="whatsapp-connection-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>WhatsApp connection</div>
          <h3 id="whatsapp-connection-heading" className="editorial" style={{ color: "var(--cream)", fontSize: 25, fontWeight: 600 }}>Connect your business number.</h3>
        </div>
        <span className={connection?.status === "connected" ? "badge badge-green" : "badge badge-cream"}>{statusLabel}</span>
      </div>

      {connection ? (
        <div style={{ marginTop: 18, padding: 16, border: "1px solid var(--wire)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 600 }}>{connection.phone_number}</div>
          <div style={{ color: "var(--mist)", fontSize: 12, marginTop: 5 }}>
            {connection.status === "connected"
              ? `Connected to ${customer?.business_name || "this workspace"}.`
              : "This workspace has an existing connection that needs support. Contact ZedPing before reconnecting."}
          </div>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--mist)", fontSize: 13, lineHeight: 1.6, marginTop: 14, maxWidth: 570 }}>
            Connect the WhatsApp Business account your team uses to speak with customers. ZedPing will securely verify the account before it is connected to this workspace.
          </p>

          {!profileComplete && <div role="status" style={{ marginTop: 14, color: "#FCD34D", fontSize: 12 }}>Complete and save the business profile above before connecting WhatsApp.</div>}
          {!emailVerified && <div role="status" style={{ marginTop: 14, color: "#FCD34D", fontSize: 12 }}>Verify your email before connecting WhatsApp.</div>}
          {!canManage && <div role="status" style={{ marginTop: 14, color: "var(--mist)", fontSize: 12 }}>Only workspace owners and admins can connect WhatsApp.</div>}
          {!configured && canManage && <div role="status" style={{ marginTop: 14, color: "#FCD34D", fontSize: 12 }}>WhatsApp self-connection is being configured for this environment. Contact ZedPing support to connect your number.</div>}

          {canManage && emailVerified && profileComplete && configured && (
            <button className="btn btn-gold" type="button" onClick={start} disabled={busy} style={{ marginTop: 18 }}>
              {phase === "preparing" ? "Preparing secure setup…" : phase === "meta" ? "Waiting for Meta…" : phase === "validating" ? "Confirming connection…" : "Connect WhatsApp"}
            </button>
          )}
        </>
      )}

      {message && <div role={phase === "error" ? "alert" : "status"} aria-live="polite" style={{ marginTop: 14, color: phase === "error" ? "#FCA5A5" : phase === "complete" ? "#86EFAC" : "var(--cream2)", fontSize: 12, lineHeight: 1.5 }}>{message}</div>}
      {phase === "error" && !connection && canManage && emailVerified && profileComplete && configured && <button type="button" className="btn btn-wire" onClick={start} style={{ marginTop: 12 }}>Try again</button>}
    </section>
  );
}
