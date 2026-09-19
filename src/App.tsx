// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppConnection } from "./WhatsAppConnection";
import { TeamMembers } from "./TeamMembers";
import { provisionWorkspaceWithGateway } from "./lib/workspaceProvisioning";
import { captureInvitationToken, clearInvitationToken } from "./lib/invitationFlow";
import { emitInvitationAuthDiagnostic } from "./lib/invitationDiagnostics";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://zzhqhgeyxbdqdkacrviq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHFoZ2V5eGJkcWRrYWNydmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMwNDEsImV4cCI6MjA5NDU3OTA0MX0.C4xDheJF3qOB7L3LWZKryNgE4-eMc05kJi4qwDhp-sI";
const API = "https://zedping-backend-production.up.railway.app";
const ZEDPING_WA = "260778621167";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const WORKSPACE_STORAGE_KEY = "zedping.activeWorkspaceId";
const nativeRequest = window.fetch.bind(window);

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  // This local value is only a convenience hint. The backend independently
  // verifies that the signed-in user belongs to the requested workspace.
  const workspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (workspaceId) headers.set("x-zedping-workspace-id", workspaceId);

  const response = await nativeRequest(input, { ...init, headers });
  if (!response.ok) {
    if (response.status === 403) window.dispatchEvent(new Event("zedping:workspace-forbidden"));
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return response;
};

function pendingInvitationToken() {
  try { return captureInvitationToken(window.sessionStorage, window.location.hash || ""); } catch { return null; }
}
function clearPendingInvitationToken() {
  try { clearInvitationToken(window.sessionStorage); } catch {}
}
function removeInvitationFragment() {
  if (window.location.hash.includes("invite=")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
async function previewInvitation(token) {
  const response = await nativeRequest(API + "/invitations/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "This invitation is no longer available.");
  }
  return response.json();
}
async function acceptInvitationToken(token) {
  if (!token) return null;
  const response = await apiFetch(API + "/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  const accepted = await response.json();
  clearPendingInvitationToken();
  removeInvitationFragment();
  return accepted;
}

async function provisionWorkspace(user, details: any = {}) {
  const gateway = {
    async findOwnedWorkspace(userId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async findMemberships(userId) {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("customer_id")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    async createWorkspace(seed) {
      const { data, error } = await supabase
        .from("customers")
        .insert(seed)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async ensureOwnerMembership(customerId, userId) {
      const { error } = await supabase
        .from("workspace_members")
        .upsert(
          { customer_id: customerId, user_id: userId, role: "owner" },
          { onConflict: "customer_id,user_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    }
  };

  return provisionWorkspaceWithGateway(gateway, user, details);
}

async function getAuthorizedWorkspaces(user) {
  const ownedWorkspace = await provisionWorkspace(user);
  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("customer_id, role")
    .eq("user_id", user.id);
  if (membershipError) throw membershipError;

  const roles = new Map();
  if (ownedWorkspace) roles.set(ownedWorkspace.id, "owner");
  for (const membership of memberships || []) {
    if (!roles.has(membership.customer_id) || membership.role === "owner") {
      roles.set(membership.customer_id, membership.role);
    }
  }

  const ids = [...roles.keys()];
  if (!ids.length) return { workspaces: [], ownedWorkspace };
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .in("id", ids);
  if (customerError) throw customerError;

  return {
    workspaces: (customers || []).map(customer => ({ ...customer, role: roles.get(customer.id) })),
    ownedWorkspace
  };
}

async function verifyWorkspaceSelection(workspaces, preferredId) {
  const preferred = workspaces.find((workspace) => workspace.id === preferredId);
  const candidates = preferred ? [preferred, ...workspaces.filter((workspace) => workspace.id !== preferred.id)] : workspaces;
  let lastError;

  for (const candidate of candidates) {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, candidate.id);
    try {
      const response = await apiFetch(`${API}/workspace`);
      const context = await response.json();
      return {
        workspace: { ...candidate, ...context.workspace, role: context.role },
        context
      };
    } catch (error) {
      lastError = error;
    }
  }

  window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  throw lastError || new Error("No authorized workspace is available for this account.");
}

import faceliftCss from "./facelift.css?inline";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --ink:   #090909;
    --deep:  #0F0F0F;
    --panel: #161616;
    --panel2:#1C1C1C;
    --cream: #F2EDE4;
    --cream2:#D4CCBE;
    --gold:  #B8922A;
    --gold2: #D4A843;
    --green: #1A3A2A;
    --green2:#22C55E;
    --mist:  #6B6B6B;
    --wire:  rgba(255,255,255,0.07);
    --wire2: rgba(184,146,42,0.2);
    --red:   #EF4444;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', sans-serif; background: var(--ink); color: var(--cream); -webkit-font-smoothing: antialiased; }
  a { text-decoration: none; color: inherit; }

  .editorial { font-family: 'Cormorant Garamond', serif; line-height: 1; }
  .mono { font-family: 'DM Mono', monospace; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.25s; border: none; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; }
  .btn-gold { background: var(--gold2); color: var(--ink); padding: 10px 20px; }
  .btn-gold:hover { background: var(--cream); transform: translateY(-1px); }
  .btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-wire { background: transparent; color: var(--cream2); border: 1px solid var(--wire); padding: 9px 18px; }
  .btn-wire:hover { border-color: var(--gold); color: var(--gold2); }
  .btn-danger { background: transparent; color: var(--error-text); border: 1px solid rgba(239,68,68,0.2); padding: 9px 18px; }

  /* Inputs */
  .input { background: rgba(255,255,255,0.02); border: 1px solid var(--wire); padding: 11px 14px; font-size: 14px; color: var(--cream); outline: none; font-family: 'DM Sans'; transition: border-color 0.2s; width: 100%; border-radius: 0; }
  .input:focus { border-color: var(--gold); }
  .input::placeholder { color: var(--mist); }
  .textarea { background: rgba(255,255,255,0.02); border: 1px solid var(--wire); padding: 11px 14px; font-size: 14px; color: var(--cream); outline: none; font-family: 'DM Sans'; width: 100%; resize: vertical; min-height: 90px; border-radius: 0; }
  .textarea:focus { border-color: var(--gold); outline: none; }
  .textarea::placeholder { color: var(--mist); }

  /* Labels */
  .label { font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 500; color: var(--mist); margin-bottom: 7px; display: block; letter-spacing: 1.5px; text-transform: uppercase; }

  /* Badges */
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; font-weight: 500; }
  .badge-gold { background: rgba(184,146,42,0.08); color: var(--gold2); border: 1px solid var(--wire2); }
  .badge-green { background: rgba(34,197,94,0.06); color: var(--success-text); border: 1px solid rgba(34,197,94,0.15); }
  .badge-blue { background: rgba(59,130,246,0.06); color: #93C5FD; border: 1px solid rgba(59,130,246,0.15); }
  .badge-red { background: rgba(239,68,68,0.06); color: var(--error-text); border: 1px solid rgba(239,68,68,0.15); }
  .badge-cream { background: rgba(242,237,228,0.04); color: var(--cream2); border: 1px solid var(--wire); }

  /* Table */
  .row { display: grid; padding: 12px 20px; border-bottom: 1px solid var(--wire); font-size: 13px; align-items: center; transition: background 0.15s; }
  .row:last-child { border-bottom: none; }
  .row:hover { background: rgba(255,255,255,0.015); }
  .th { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--mist); }

  /* Sidebar */
  .slink { display: flex; align-items: center; gap: 10px; padding: 9px 16px; font-size: 13px; font-weight: 400; color: var(--mist); cursor: pointer; transition: all 0.15s; border: none; background: transparent; width: 100%; text-align: left; font-family: 'DM Sans'; border-left: 2px solid transparent; }
  .slink:hover { color: var(--cream); background: rgba(255,255,255,0.02); }
  .slink.active { color: var(--gold2); background: rgba(184,146,42,0.04); border-left-color: var(--gold); }

  /* Card */
  .card { background: var(--panel); border: 1px solid var(--wire); }
  .card-gold { background: var(--panel); border: 1px solid var(--wire2); }

  /* Spinner */
  .spin { width: 18px; height: 18px; border: 1px solid rgba(255,255,255,0.08); border-top-color: var(--gold2); border-radius: 50%; animation: rot 0.7s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }

  /* Auth */
  .auth-card { background: var(--panel); border: 1px solid var(--wire); padding: 44px 40px; position: relative; }
  .auth-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: 0.5; }

  /* Plan selector */
  .plan-sel { background: rgba(255,255,255,0.02); border: 1px solid var(--wire); padding: 12px 10px; cursor: pointer; transition: all 0.15s; text-align: center; }
  .plan-sel.on { background: rgba(184,146,42,0.06); border-color: var(--gold); }

  /* Progress */
  .progress { height: 1px; background: rgba(255,255,255,0.04); overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold2)); }

  /* Gold rule */
  .gold-rule { height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: 0.3; }

  /* Keyword tag */
  .kw-tag { display: inline-block; background: rgba(184,146,42,0.06); border: 1px solid var(--wire2); padding: 3px 10px; }

  /* Mobile */
  .sidebar { width: 220px; background: var(--deep); border-right: 1px solid var(--wire); display: flex; flex-direction: column; height: 100vh; position: fixed; top: 0; left: 0; z-index: 100; transition: transform 0.3s ease; }
  .main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 99; }
  .mob-bar { display: none; }
  .desk-bar { display: flex; }

  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.open { transform: translateX(0); }
    .overlay.show { display: block; }
    .main { margin-left: 0; }
    .mob-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 56px; background: var(--deep); border-bottom: 1px solid var(--wire); position: sticky; top: 0; z-index: 50; }
    .desk-bar { display: none !important; }
    .hide-m { display: none !important; }
    .pad { padding: 18px !important; }
    .stat-g { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
  }

  ${faceliftCss}
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--ink); }
  ::-webkit-scrollbar-thumb { background: rgba(184,146,42,0.3); }
`;

// Icons
const Ic = ({ n, s = 15, c = "currentColor" }) => {
  const d = {
    home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    broadcast: "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0 M16.24 7.76a6 6 0 010 8.49m-8.48 0a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14",
    contacts: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 108 0 4 4 0 00-8 0 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    messages: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
    auto: "M13 10V3L4 14h7v7l9-11h-7z",
    catalog: "M21 8v13a2 2 0 01-2 2H5a2 2 0 01-2-2V8 M1 3h22v5H1z M10 12h4",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
    plus: "M12 5v14 M5 12h14",
    send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
    upload: "M16 16l-4-4-4 4 M12 12v9 M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3",
    search: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
    refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 106 0 3 3 0 00-6 0",
    eyeoff: "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24 M1 1l22 22",
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d[n]} /></svg>;
};

function Logo({ size = "md" }) {
  const sz = size === "lg" ? 44 : size === "sm" ? 28 : 34;
  const fs = size === "lg" ? 22 : size === "sm" ? 16 : 18;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/zedping-logo-v3.svg" alt="" width={sz} height={sz} style={{ display: "block", objectFit: "contain", flexShrink: 0, border: 0, background: "transparent" }} />
      <span style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600, fontSize: fs, color: "var(--cream)", letterSpacing: 0.5 }}>
        Zed<span style={{ color: "var(--gold2)" }}>Ping</span>
      </span>
    </div>
  );
}

function Loader() {
  return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spin" /></div>;
}

function Empty({ msg = "Nothing here yet" }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div className="mono" style={{ color: "var(--mist)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{msg}</div>
    </div>
  );
}

function useAPI(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const run = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}${endpoint}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { run(); }, deps);
  return { data, loading, error, refetch: run };
}

// ── AUTH LAYOUT ───────────────────────────────────────────────────────────────
function AuthWrap({ children }) {
  return (
    <div className="auth-wrap" style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,146,42,0.05) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,58,42,0.12) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
      {[25,50,75].map(x => <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 1, background: "rgba(255,255,255,0.015)", pointerEvents: "none" }} />)}
      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}><Logo size="lg" /></div>
        {children}
      </div>
    </div>
  );
}

// ── SIGNUP ────────────────────────────────────────────────────────────────────
function SignUp({ onSwitch, onAuth, invitation }) {
  const invited = Boolean(invitation?.email);
  const [f, setF] = useState({ name:"", business_name:"", email:"", phone:"", password:"" });
  const [plan, setPlan] = useState("business");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const set = (k,v) => setF(p => ({ ...p, [k]: v }));
  useEffect(() => { if (invitation?.email) setF(current => ({ ...current, email: invitation.email })); }, [invitation?.email]);

  const resendVerification = async () => {
    if (!verificationEmail) return;
    setResending(true); setResendStatus("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setResendStatus("Verification email resent. Check your inbox.");
    } catch (error) {
      setResendStatus(error?.message || "We could not resend the verification email.");
    } finally { setResending(false); }
  };

  const submit = async () => {
    if (!f.name||!f.email||!f.password||(!invited&&!f.business_name)) { setErr("Please fill in all required fields."); return; }
    if (f.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: invited ? { name: f.name } : { name: f.name, business_name: f.business_name, phone: f.phone, subscription_plan: plan }, emailRedirectTo: window.location.origin } });
      if (error) throw error;
      if (!data.user) throw new Error("Sign up did not return a user.");
      if (!data.session) {
        setVerificationEmail(f.email);
        return;
      }
      await onAuth(data.user);
    } catch (e) { setErr(e.message || "Sign up failed."); }
    finally { setLoading(false); }
  };

  const plans = [
    { id: "starter", label: "Starter", price: "K850" },
    { id: "business", label: "Business", price: "K1,500", popular: true },
    { id: "pro", label: "Pro", price: "K2,500" },
  ];

  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{invited ? "WORKSPACE INVITATION" : "GET STARTED"}</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 6, letterSpacing: -0.5, fontWeight: 600 }}>{invited ? "Create your account" : "Create your ZedPing account"}</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 22, lineHeight: 1.7 }}>{invited ? "You’ve been invited to join " + (invitation.business_name || "a ZedPing workspace") + ". Create your own password; after email verification, the invitation will resume automatically." : "Build smarter customer communication with ZedPing."}</p>
        {invited && <div role="status" style={{ marginBottom: 18, padding: "12px 14px", border: "1px solid var(--wire2)", background: "rgba(184,146,42,0.05)", color: "var(--cream2)", fontSize: 12 }}>{invitation.email}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label className="label">Your Name *</label><input aria-label="Your name" autoComplete="name" className="input" placeholder="Your name" value={f.name} onChange={e=>set("name",e.target.value)} /></div>
            {!invited && <div><label className="label">Business Name *</label><input aria-label="Business name" className="input" placeholder="My Business" value={f.business_name} onChange={e=>set("business_name",e.target.value)} /></div>}
          </div>
          <div><label className="label">Email *</label><input aria-label="Email" autoComplete="email" className="input" type="email" placeholder="you@business.com" value={f.email} readOnly={invited} onChange={e=>set("email",e.target.value)} /></div>
          {!invited && <div><label className="label">Phone</label><input className="input" placeholder="+260971234567" value={f.phone} onChange={e=>set("phone",e.target.value)} /></div>}
          <div>
            <label className="label">Password *</label>
            <div style={{ position: "relative" }}>
              <input aria-label="Password" className="input" type={showP?"text":"password"} placeholder="Min 6 characters" value={f.password} onChange={e=>set("password",e.target.value)} style={{ paddingRight: 44 }} />
              <button aria-label={showP ? "Hide password" : "Show password"} type="button" onClick={()=>setShowP(s=>!s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--mist)" }}>
                <Ic n={showP?"eyeoff":"eye"} s={14} c="var(--mist)" />
              </button>
            </div>
          </div>
          {!invited && <div>
            <label className="label">Choose Plan</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {plans.map(p => (
                <div key={p.id} className={`plan-sel ${plan===p.id?"on":""}`} onClick={()=>setPlan(p.id)} style={{ position: "relative" }}>
                  {p.popular && <div className="mono" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", background: "var(--gold)", color: "var(--ink)", fontSize: 7, padding: "2px 8px", whiteSpace: "nowrap", letterSpacing: 1 }}>POPULAR</div>}
                  <div className="mono" style={{ fontSize: 9, color: plan===p.id ? "var(--gold2)" : "var(--mist)", letterSpacing: 1 }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: plan===p.id ? "var(--cream)" : "var(--mist)", marginTop: 3, fontWeight: 600 }}>{p.price}</div>
                </div>
              ))}
            </div>
          </div>}
          {verificationEmail && <div className="mono" role="status" style={{ color: "var(--success-text)", fontSize: 11, lineHeight: 1.6 }}>
            Account created. Verify <strong>{verificationEmail}</strong> before signing in.
            <button type="button" onClick={resendVerification} disabled={resending} style={{ display: "block", marginTop: 8, padding: 0, border: 0, background: "transparent", color: "var(--gold2)", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>
              {resending ? "Resending…" : "Resend verification email"}
            </button>
            {resendStatus && <span style={{ display: "block", marginTop: 6, color: resendStatus.includes("resent") ? "var(--success-text)" : "var(--error-text)" }}>{resendStatus}</span>}
          </div>}
          {err && <div className="mono" role="alert" style={{ color: "var(--error-text)", fontSize: 11, letterSpacing: 0.5 }}>{err}</div>}
          <button className="btn btn-gold" onClick={submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11, marginTop: 4 }}>
            {loading ? <div className="spin" /> : "Create account →"}
          </button>
        </div>
        <p style={{ textAlign: "center", color: "var(--mist)", fontSize: 13, marginTop: 20 }}>
          Already have an account?{" "}
          <span style={{ color: "var(--gold2)", cursor: "pointer", fontWeight: 500 }} onClick={onSwitch}>Sign in</span>
        </p>
      </div>
    </AuthWrap>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onSwitch, onAuth, invitation }) {
  const invited = Boolean(invitation?.email);
  const [f, setF] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);
  const [reset, setReset] = useState(false);
  const [forgot, setForgot] = useState(false);
  const set = (k,v) => setF(p => ({ ...p, [k]: v }));
  useEffect(() => { if (invitation?.email) setF(current => ({ ...current, email: invitation.email })); }, [invitation?.email]);

  const submit = async () => {
    if (!f.email||!f.password) { setErr("Please enter your email and password."); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) throw error;
      await onAuth(data.user);
    } catch (e) { setErr(e.message === "Invalid login credentials" ? "Incorrect email or password." : e.message); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    if (!f.email) { setErr("Please enter your email first."); return; }
    setLoading(true); setErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin });
      if (error) throw error;
      setReset(true);
    } catch (error) {
      setErr(error?.message || "We could not send the password reset email.");
    } finally { setLoading(false); }
  };

  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{forgot ? "RESET PASSWORD" : invited ? "WORKSPACE INVITATION" : "WELCOME BACK"}</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 6, letterSpacing: -0.5, fontWeight: 600 }}>{forgot ? "Forgot your password?" : invited ? "Sign in to join" : "Sign in to your account"}</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 32 }}>{forgot ? "Enter your email and we’ll send you a link to reset your password." : invited ? "Sign in with the invited email. Your invitation will resume automatically." : "Keep your business conversations moving — smarter, faster, on WhatsApp."}</p>
        {invited && <div role="status" style={{ marginBottom: 18, padding: "12px 14px", border: "1px solid var(--wire2)", background: "rgba(184,146,42,0.05)", color: "var(--cream2)", fontSize: 12 }}>You’ve been invited to join {invitation.business_name || "a ZedPing workspace"}<br />{invitation.email}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label className="label">Email</label><input aria-label="Email" autoComplete="email" className="input" type="email" placeholder="you@business.com" value={f.email} readOnly={invited} onChange={e=>set("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&(forgot ? sendReset() : submit())} /></div>
          {!forgot && <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <label className="label" style={{ margin: 0 }}>Password</label>
              <button type="button" className="text-button" onClick={()=>{setForgot(true);setErr("");}}>Forgot password?</button>
            </div>
            <div style={{ position: "relative" }}>
              <input aria-label="Password" className="input" type={showP?"text":"password"} placeholder="Your password" value={f.password} onChange={e=>set("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&(forgot ? sendReset() : submit())} style={{ paddingRight: 44 }} />
              <button aria-label={showP ? "Hide password" : "Show password"} type="button" onClick={()=>setShowP(s=>!s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                <Ic n={showP?"eyeoff":"eye"} s={14} c="var(--mist)" />
              </button>
            </div>
          </div>}
          {err && <div className="mono" style={{ color: "var(--error-text)", fontSize: 11 }}>{err}</div>}
          {reset && <div className="mono" style={{ color: "var(--success-text)", fontSize: 11 }}>Reset email sent. Check your inbox.</div>}
          <button className="btn btn-gold" onClick={forgot ? sendReset : submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11 }}>
            {loading ? <div className="spin" /> : forgot ? "Send reset link →" : "Sign in →"}
          </button>
        </div>
        <p style={{ textAlign: "center", color: "var(--mist)", fontSize: 13, marginTop: 20 }}>
          {forgot ? "Remember your password?" : "Don’t have an account?"}{" "}
          <button className="text-button" onClick={()=>{if(forgot){setForgot(false);setErr("");}else onSwitch();}}>{forgot ? "Back to sign in" : "Create account"}</button>
        </p>
      </div>
    </AuthWrap>
  );
}

// ── PASSWORD RESET ────────────────────────────────────────────────────────────
function ResetPass({ onDone }) {
  const [pw, setPw] = useState(""); const [cpw, setCpw] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState(false);
  const submit = async () => {
    if (!pw||!cpw) { setErr("Please fill in both fields."); return; }
    if (pw!==cpw) { setErr("Passwords do not match."); return; }
    if (pw.length<6) { setErr("Minimum 6 characters."); return; }
    setLoading(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true);
      window.history.replaceState(null,"",window.location.pathname);
      setTimeout(()=>onDone(), 2000);
    } catch(e) { setErr(e.message||"Failed."); }
    finally { setLoading(false); }
  };
  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, marginBottom: 6 }}>RESET PASSWORD</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 28, fontWeight: 600 }}>New password.</h2>
        {ok ? <div className="mono" style={{ color: "var(--success-text)", fontSize: 11, textAlign: "center", padding: "24px 0" }}>Password updated. Redirecting...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label className="label">New Password</label><input className="input" type="password" placeholder="Min 6 characters" value={pw} onChange={e=>setPw(e.target.value)} /></div>
            <div><label className="label">Confirm Password</label><input className="input" type="password" placeholder="Repeat password" value={cpw} onChange={e=>setCpw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
            {err && <div className="mono" style={{ color: "var(--error-text)", fontSize: 11 }}>{err}</div>}
            <button className="btn btn-gold" onClick={submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11 }}>
              {loading ? <div className="spin" /> : "Set New Password →"}
            </button>
          </div>
        )}
      </div>
    </AuthWrap>
  );
}

// ── EMAIL VERIFICATION ────────────────────────────────────────────────────────
function VerifyEmail({ user, onLogout, invitation }) {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true); setStatus("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setStatus("Verification email resent. Check your inbox.");
    } catch (error) {
      setStatus(error?.message || "We could not resend the verification email.");
    } finally { setSending(false); }
  };

  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, marginBottom: 6 }}>Verify your email</div>
        <h2 className="editorial" style={{ fontSize: 36, color: "var(--cream)", marginBottom: 12, fontWeight: 600 }}>One more step.</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          Verify <strong style={{ color: "var(--cream)" }}>{user.email}</strong> before completing setup or connecting WhatsApp.{invitation?.business_name ? " After verification, your invitation to " + invitation.business_name + " will resume automatically." : ""}
        </p>
        {status && <div className="mono" role="status" style={{ color: status.includes("resent") ? "var(--success-text)" : "var(--error-text)", fontSize: 11, marginBottom: 16 }}>{status}</div>}
        <button className="btn btn-gold" onClick={resend} disabled={sending} style={{ width: "100%", padding: "13px", fontSize: 11 }}>
          {sending ? <div className="spin" /> : "Resend Verification Email"}
        </button>
        <button className="btn btn-wire" onClick={onLogout} style={{ width: "100%", padding: "12px", fontSize: 10, marginTop: 10 }}>Sign Out</button>
      </div>
    </AuthWrap>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, customer, onLogout, open, onClose }) {
  const links = [
    { id: "overview", label: "Dashboard", icon: "home" },
    { id: "broadcasts", label: "Broadcasts", icon: "broadcast" },
    { id: "contacts", label: "Contacts", icon: "contacts" },
    { id: "messages", label: "Team Inbox", icon: "messages" },
    { id: "automations", label: "Automations", icon: "auto" },
    { id: "templates", label: "WhatsApp Templates", icon: "messages" },
    { id: "content", label: "Content Library", icon: "catalog" },
    { id: "team", label: "Team Members", icon: "contacts" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  const initial = (customer?.business_name || user?.email || "Z").charAt(0).toUpperCase();

  return (
    <>
      <div className={`overlay ${open?"show":""}`} onClick={onClose} />
      <div className={`sidebar ${open?"open":""}`}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--wire)", position: "relative" }}>
          <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
          <Logo size="sm" />
        </div>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--wire)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "var(--green)", border: "1px solid var(--wire2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="editorial" style={{ color: "var(--gold2)", fontSize: 14, fontWeight: 600 }}>{initial}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer?.business_name || "My Business"}</div>
              <div className="mono" style={{ fontSize: 8, color: "var(--gold2)", letterSpacing: 1, textTransform: "uppercase", marginTop: 1 }}>{(customer?.subscription_plan||"starter").toUpperCase()}</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          <div className="mono" style={{ fontSize: 8, color: "var(--mist)", letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px 10px", opacity: 0.5 }}>Navigation</div>
          {links.map(l => (
            <button key={l.id} className={`slink ${active===l.id?"active":""}`} onClick={()=>{ setActive(l.id); onClose(); }}>
              <span style={{ color: active===l.id ? "var(--gold2)" : "var(--mist)", flexShrink: 0 }}><Ic n={l.icon} s={13} c="currentColor" /></span>
              {l.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "8px 8px 14px" }}>
          <button className="slink" onClick={onLogout} style={{ color: "rgba(239,68,68,0.6)" }}>
            <Ic n="logout" s={13} c="rgba(239,68,68,0.6)" /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
function Topbar({ title, user, customer, workspaces, onWorkspaceChange, activeWorkspaceId, switching }) {
  const initial = (customer?.business_name || user?.email || "Z").charAt(0).toUpperCase();
  return (
    <div className="desk-bar" style={{ height: 56, alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: "1px solid var(--wire)", background: "var(--workspace-bg)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 1, height: 16, background: "var(--gold)", opacity: 0.6 }} />
        <span className="mono" style={{ fontSize: 10, color: "var(--cream2)", letterSpacing: 2, textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {workspaces.length > 1 && <select aria-label="Active workspace" value={activeWorkspaceId || ""} onChange={event => onWorkspaceChange(event.target.value)} disabled={switching} className="input" style={{ width: 190, padding: "7px 10px", fontSize: 12, opacity: switching ? 0.6 : 1 }}>
          {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.business_name}</option>)}
        </select>}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cream)" }}>{switching ? "Switching workspace…" : (customer?.business_name || "My Business")}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--mist)" }}>{user?.email}</div>
        </div>
        <div style={{ width: 32, height: 32, background: "var(--green)", border: "1px solid var(--wire2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="editorial" style={{ color: "var(--gold2)", fontSize: 15, fontWeight: 600 }}>{initial}</span>
        </div>
      </div>
    </div>
  );
}

function MobTopbar({ onMenu, onLogout, workspaces, activeWorkspaceId, onWorkspaceChange, switching }) {
  return (
    <div className="mob-bar">
      <button aria-label="Open navigation" onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cream)", padding: 4 }}><Ic n="menu" s={20} c="var(--cream)" /></button>
      {workspaces.length > 1 ? <select aria-label="Active workspace" value={activeWorkspaceId || ""} onChange={event => onWorkspaceChange(event.target.value)} disabled={switching} className="input" style={{ width: "42%", padding: "6px 8px", fontSize: 11, opacity: switching ? 0.6 : 1 }}>
        {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.business_name}</option>)}
      </select> : <Logo size="sm" />}
      <button onClick={onLogout} className="btn btn-danger" style={{ fontSize: 9, padding: "6px 12px" }}>Exit</button>
    </div>
  );
}

// ── PAGE HEADER ───────────────────────────────────────────────────────────────
function PageHead({ label, title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
      <div>
        {label && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ width: 20, height: 1, background: "var(--gold)", opacity: 0.6 }} /><span className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase" }}>{label}</span></div>}
        <h2 className="editorial" style={{ fontSize: 28, color: "var(--cream)", fontWeight: 600, letterSpacing: -0.3 }}>{title}</h2>
        {sub && <p style={{ color: "var(--mist)", fontSize: 13, marginTop: 4 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function Overview({ customer, user, onNavigate, whatsappConnectionState }) {
  const { data: msgs, loading: mL } = useAPI("/messages");
  const { data: contacts, loading: cL } = useAPI("/contacts");
  const { data: autos } = useAPI("/automations");
  const { data: setup, loading: setupLoading } = useAPI("/workspace");
  const todayOut = (msgs||[]).filter(m => new Date(m.created_at).toDateString()===new Date().toDateString()&&m.direction==="outbound").length;
  const h = new Date().getHours();
  const greet = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  const whatsappConnected = Boolean(setup?.whatsapp_connection?.status === "connected" || customer?.whatsapp_connected_at);
  const profileComplete = Boolean(customer?.profile_completed_at);
  const connectionFailed = whatsappConnectionState?.phase === "error";
  const checklist = setup?.setup_checklist;
  const discovery = setup?.discovery;
  const recommendations = setup?.recommendations;
  const activation = whatsappConnected
    ? { title: "WhatsApp is connected", detail: "This workspace is ready to send and receive WhatsApp messages.", action: "Manage connection →", tone: "#23734a" }
    : connectionFailed
      ? { title: "WhatsApp connection needs attention", detail: whatsappConnectionState.message || "No connection was created. Review the connection details and try again.", action: "Review connection →", tone: "#b33a35" }
      : profileComplete
        ? { title: "Connect your WhatsApp number", detail: "Securely connect the WhatsApp Business account your team uses to speak with customers.", action: "Connect WhatsApp →", tone: "var(--gold2)" }
        : { title: "Complete your business profile", detail: "Add your workspace details before connecting WhatsApp.", action: "Complete profile →", tone: "var(--gold2)" };
  const stats = [
    { label: "Sent Today", value: mL || !Array.isArray(msgs) ? "—" : todayOut, sub: "Outbound messages", color: "var(--gold2)" },
    { label: "Contacts", value: cL || !Array.isArray(contacts) ? "—" : contacts.length, sub: "In your list", color: "var(--cream2)" },
    { label: "Active Keywords", value: Array.isArray(autos) ? autos.filter(a=>a.is_active&&a.trigger_type==="keyword").length : "—", sub: "Automations live", color: "var(--gold2)" },
    { label: "Plan", value: (customer?.subscription_plan||"Starter").charAt(0).toUpperCase()+(customer?.subscription_plan||"starter").slice(1), sub: customer?.subscription_status||"trial", color: "var(--cream2)" },
  ];

  return (
    <div className="pad" style={{ padding: 28 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 20, height: 1, background: "var(--gold)", opacity: 0.6 }} />
          <span className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase" }}>YOUR WORKSPACE</span>
        </div>
        <h1 className="editorial" style={{ fontSize: 36, color: "var(--cream)", fontWeight: 600, marginBottom: 4, letterSpacing: -0.5 }}>{greet}, {customer?.business_name || "your workspace"} 👋</h1>
        <p style={{ color: "var(--mist)", fontSize: 14 }}>Here’s what’s happening across your WhatsApp workspace.</p>
      </div>

      {!setupLoading && checklist?.presentation === "primary" && <section className="card-gold" style={{ padding: 22, marginBottom: 18 }} aria-label="Getting started">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>Getting started</div>
            <div className="editorial" style={{ fontSize: 28, color: "var(--cream)", fontWeight: 600 }}>Let’s get you set up</div>
            <p style={{ color: "var(--mist)", fontSize: 12, marginTop: 7 }}>Complete these steps to get the most out of ZedPing.</p>
          </div>
          <div className="mono" style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: 1 }}>{checklist.completed}/{checklist.total} COMPLETE</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 9, marginTop: 18 }}>
          {checklist.items.map((item) => <div key={item.key} style={{ display: "flex", gap: 9, alignItems: "center", color: item.complete ? "var(--cream)" : "var(--mist)", fontSize: 12 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: item.complete ? "var(--gold)" : "rgba(255,255,255,0.08)", color: item.complete ? "var(--ink)" : "var(--mist)", fontSize: 10 }}>{item.complete ? "✓" : "○"}</span>
            {item.label}
          </div>)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button className="btn btn-gold" onClick={() => onNavigate?.("settings")}>{discovery?.completed_at ? "Update your setup" : "Tell us what you need"}</button>
          <button className="btn btn-wire" onClick={() => onNavigate?.("contacts")}>Add contacts</button>
        </div>
      </section>}

      {!setupLoading && checklist?.presentation === "secondary" && <div className="card" style={{ padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "var(--mist)", fontSize: 12 }}>Setup progress: {checklist.completed} of {checklist.total} steps complete.</span>
        <button className="btn btn-wire" onClick={() => onNavigate?.("settings")}>View setup</button>
      </div>}

      <div style={{ background: connectionFailed ? "#fff1f0" : "#fffaf0", border: `1px solid ${connectionFailed ? "rgba(239,68,68,0.35)" : "var(--wire2)"}`, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
        <span aria-hidden="true" style={{ fontSize: 18 }}>{whatsappConnected ? "✓" : connectionFailed ? "!" : "📱"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: activation.tone, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{activation.title}</div>
          <div style={{ color: "var(--mist)", fontSize: 13 }}>{activation.detail}</div>
        </div>
        <button type="button" onClick={() => onNavigate?.("settings")} className={connectionFailed ? "btn btn-wire" : "btn btn-gold"} style={{ flexShrink: 0, padding: "9px 18px", fontSize: 10 }}>{activation.action}</button>
      </div>

      {discovery?.completed_at && (recommendations?.packs?.length || recommendations?.automations?.length) > 0 && <section className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Recommended for your business</div>
        <p style={{ color: "var(--mist)", fontSize: 12, marginBottom: 14 }}>Based on your industry and the jobs you chose for ZedPing.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[...(recommendations?.packs || []), ...(recommendations?.automations || [])].slice(0,4).map((item) => <div key={item.id} style={{ border: "1px solid var(--wire)", padding: 14 }}>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600 }}>{item.name}</div>
            <div style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.45, marginTop: 5 }}>{item.description}</div>
            <button className="btn btn-wire" style={{ marginTop: 12, fontSize: 9, padding: "7px 10px" }} onClick={() => onNavigate?.("automations")}>Explore automations</button>
          </div>)}
        </div>
      </section>}

      <div className="stat-g" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {stats.map((s,i) => (
          <div className="kpi-card" key={i} style={{ background: "var(--panel)", border: "1px solid var(--wire)", padding: "20px 18px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.3 }} />
            <div className="editorial" style={{ fontSize: 40, color: "var(--cream)", lineHeight: 1, marginBottom: 8, fontWeight: 600 }}>{s.value}</div>
            <div className="mono" style={{ fontSize: 9, color: s.color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <section className="quick-actions" aria-label="Quick actions">
        <h2>Quick actions</h2>
        <div className="quick-grid">
          {[{id:"broadcasts",title:"Send a message",detail:"Open your broadcast tools",icon:"send"},{id:"contacts",title:"Manage contacts",detail:"Add, import and organise",icon:"contacts"},{id:"automations",title:"Create automation",detail:"Set up a keyword reply",icon:"auto"}].map(action => <button key={action.id} className="quick-action" onClick={()=>onNavigate(action.id)}><Ic n={action.icon} s={20}/><span><strong>{action.title}</strong><small>{action.detail}</small></span><span aria-hidden="true">↗</span></button>)}
        </div>
      </section>
      <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Recent Messages</div>
      <div className="card">
        {mL ? <Loader /> : !(msgs?.length) ? <Empty msg="No messages yet" /> :
          (msgs||[]).slice(0,6).map((m,i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: "1.2fr 2.5fr 90px 80px", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--cream)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from_number||m.to_number}</div>
              <div style={{ fontSize: 13, color: "var(--mist)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
              <div className={`badge ${m.direction==="inbound"?"badge-blue":"badge-green"}`}>{m.direction==="inbound"?"IN":"OUT"}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--mist)" }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── BROADCASTS ────────────────────────────────────────────────────────────────
function Broadcasts({ customer }) {
  const { data: history, loading: historyLoading, refetch: refetchHistory } = useAPI("/broadcasts/scheduled");
  const { data: contacts, loading: contactsLoading } = useAPI("/contacts");
  const [mode, setMode] = useState("list");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [uploadReport, setUploadReport] = useState(null);
  const [saveImported, setSaveImported] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all");
  const uploadRef = useRef();

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      if (!customer?.id) return;
      const { data } = await supabase.from("contact_groups").select("id,name,description,total_contacts").eq("customer_id", customer.id).order("name");
      if (alive) setGroups(data || []);
    }
    loadGroups();
    return () => { alive = false; };
  }, [customer?.id]);

  const normalizePhone = (value) => {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (raw.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return "+" + digits;
    if (/^260\d{9}$/.test(digits)) return "+" + digits;
    if (/^0\d{9}$/.test(digits)) return "+260" + digits.slice(1);
    if (/^[79]\d{8}$/.test(digits)) return "+260" + digits;
    if (/^[1-9]\d{7,14}$/.test(digits)) return "+" + digits;
    return null;
  };

  const setGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    setRecipients([]);
    setNotice(null);
    if (!groupId) return;
    const { data: memberships, error } = await supabase.from("contact_group_members").select("contact_id").eq("group_id", groupId);
    if (error) { setNotice({ ok: false, text: "Could not load this contact list." }); return; }
    const ids = new Set((memberships || []).map(row => row.contact_id));
    const selected = (contacts || []).filter(contact => ids.has(contact.id));
    setRecipients(selected);
  };

  const parseUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadReport(null); setRecipients([]); setNotice(null);
    if (file.size > 5 * 1024 * 1024) { setUploadReport({ valid: [], invalid: [{ row: 0, reason: "File must be 5 MB or smaller" }] }); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
      const headers = (rows[0] || []).map(value => String(value).trim().toLowerCase());
      const nameIndex = headers.findIndex(header => header.includes("name"));
      const phoneIndex = headers.findIndex(header => header.includes("phone") || header.includes("number") || header.includes("mobile"));
      if (nameIndex < 0 || phoneIndex < 0) throw new Error("Your file needs Name and Phone Number columns.");
      const invalid = [], seen = new Set(), valid = [];
      rows.slice(1).forEach((row, index) => {
        if (!row.some(value => String(value).trim())) return;
        const phone_number = normalizePhone(row[phoneIndex]);
        const name = String(row[nameIndex] || "").trim();
        if (!name || !phone_number) { invalid.push({ row: index + 2, reason: !name ? "Missing name" : "Invalid phone number" }); return; }
        if (!seen.has(phone_number)) { seen.add(phone_number); valid.push({ name, phone_number }); }
      });
      setRecipients(valid); setUploadReport({ valid, invalid, file: file.name });
    } catch (error) { setUploadReport({ valid: [], invalid: [{ row: 0, reason: error.message || "Could not read this file" }] }); }
  };

  const recipientsForMode = () => {
    if (mode === "single") {
      const phone_number = normalizePhone(phone);
      return phone_number ? [{ name: "Contact", phone_number }] : [];
    }
    return recipients;
  };

  const send = async () => {
    const selected = recipientsForMode();
    if (!message.trim() || !selected.length) { setNotice({ ok: false, text: "Add a message and at least one valid recipient." }); return; }
    setSending(true); setNotice(null);
    try {
      if (mode === "upload" && saveImported && uploadReport?.valid?.length) {
        await apiFetch(`${API}/contacts/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: uploadReport.valid }) });
      }
      const response = await apiFetch(`${API}/broadcasts/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: selected, message: message.trim() }) });
      const result = await response.json();
      setNotice({ ok: result.failed === 0, text: `Sent: ${result.sent} · Failed: ${result.failed}` });
      if (mode === "single") setPhone("");
      if (mode === "upload") { setRecipients([]); setUploadReport(null); }
      refetchHistory();
    } catch (error) { setNotice({ ok: false, text: error.message || "Broadcast could not be sent." }); }
    finally { setSending(false); }
  };

  const statusFor = (broadcast) => {
    if (broadcast.status === "completed") return { label: "PROCESSED", cls: "badge-green" };
    if (broadcast.status === "failed") return { label: "FAILED", cls: "badge-cream" };
    if (broadcast.status === "pending" || broadcast.status === "sending") return { label: "SCHEDULED", cls: "badge-gold" };
    return null;
  };
  const activity = (history || []).filter(broadcast => activityFilter === "all" || statusFor(broadcast)?.label.toLowerCase() === activityFilter);

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="WhatsApp" title="Broadcasts." sub="Send messages to your contact list" />
      <div className="card" style={{ padding: 24, marginBottom: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Send Message</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[["list", "Select Contact List"], ["upload", "Upload Contacts"], ["single", "Single Number"]].map(([id, label]) => <button key={id} className={mode === id ? "btn btn-gold" : "btn btn-wire"} onClick={() => { setMode(id); setNotice(null); }} style={{ fontSize: 10, padding: "8px 12px" }}>{label}</button>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "list" && <div>
            <label className="label">Contact List</label>
            <select className="input" value={selectedGroupId} onChange={event => setGroup(event.target.value)} disabled={contactsLoading}>
              <option value="">Select an existing list…</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            {groups.length === 0 && <div className="mono" style={{ fontSize: 10, color: "var(--mist)", marginTop: 8 }}>No contact lists with members are available yet. Create and populate a list in Contacts first.</div>}
            {selectedGroupId && <div className="mono" style={{ fontSize: 10, color: "var(--gold2)", marginTop: 8 }}>{recipients.length} recipient{recipients.length === 1 ? "" : "s"} selected</div>}
          </div>}
          {mode === "upload" && <div>
            <label className="label">CSV or XLSX file</label>
            <input ref={uploadRef} type="file" accept=".csv,.xlsx" onChange={parseUpload} className="input" style={{ padding: 9 }} />
            <div className="mono" style={{ fontSize: 10, color: "var(--mist)", marginTop: 8 }}>Required columns: Name, Phone Number · 5 MB maximum</div>
            {uploadReport && <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--wire)", background: "rgba(255,255,255,0.02)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--success-text)" }}>{uploadReport.valid.length} valid recipient{uploadReport.valid.length === 1 ? "" : "s"}</div>
              {uploadReport.invalid.length > 0 && <div className="mono" style={{ fontSize: 10, color: "var(--error-text)", marginTop: 5 }}>{uploadReport.invalid.length} invalid row{uploadReport.invalid.length === 1 ? "" : "s"} · {uploadReport.invalid.slice(0, 3).map(item => item.row ? `Row ${item.row}: ${item.reason}` : item.reason).join(" · ")}</div>}
            </div>}
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12, color: "var(--mist)", cursor: "pointer" }}><input type="checkbox" checked={saveImported} onChange={event => setSaveImported(event.target.checked)} />Save these contacts to Contacts</label>
          </div>}
          {mode === "single" && <div><label className="label">Phone Number</label><input className="input" placeholder="+260971234567" value={phone} onChange={event => setPhone(event.target.value)} /></div>}
          <div><label className="label">Message</label><textarea className="textarea" maxLength={4096} placeholder="Your message here..." value={message} onChange={event => setMessage(event.target.value)} /><div className="mono" style={{ fontSize: 10, color: "var(--mist)", textAlign: "right", marginTop: 5 }}>{message.length}/4096</div></div>
          {notice && <div className="mono" style={{ fontSize: 11, color: notice.ok ? "var(--success-text)" : "var(--error-text)" }}>{notice.text}</div>}
          <button className="btn btn-gold" onClick={send} disabled={sending} style={{ alignSelf: "flex-start", padding: "10px 22px" }}><Ic n="send" s={12} c="var(--ink)" />{sending ? "Sending..." : "Send Now"}</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--mist)", letterSpacing: 2, textTransform: "uppercase" }}>Broadcast Activity</div>
        <div style={{ display: "flex", gap: 6 }}>{[["all","All"],["scheduled","Scheduled"],["processed","Processed"],["failed","Failed"]].map(([id,label]) => <button key={id} className={activityFilter === id ? "btn btn-gold" : "btn btn-wire"} onClick={() => setActivityFilter(id)} style={{ padding: "5px 8px", fontSize: 9 }}>{label}</button>)}</div>
      </div>
      <div className="card">
        {historyLoading ? <Loader /> : !activity.length ? <Empty msg="No broadcast activity yet" /> : activity.map(broadcast => {
          const status = statusFor(broadcast); if (!status) return null;
          return <div key={broadcast.id} className="row" style={{ gridTemplateColumns: "2fr 2fr 1fr 1fr 90px", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)" }}>{broadcast.broadcast_name || "Untitled Broadcast"}</div>
            <div style={{ fontSize: 12, color: "var(--mist)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{broadcast.message}</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{Array.isArray(broadcast.contacts) ? broadcast.contacts.length : 0} recipients</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{new Date(broadcast.completed_at || broadcast.scheduled_at || broadcast.created_at).toLocaleString()}</div>
            <div className={"badge " + status.cls}>{status.label}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
function Contacts({ customer }) {
  const { data, loading, refetch } = useAPI("/contacts");
  const [tab, setTab] = useState("contacts");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [toast, setToast] = useState(null);

  const notify = (text, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 3000); };
  const filtered = (data || []).filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone_number || "").includes(search));

  async function loadGroups() {
    if (!customer?.id) return;
    setGroupsLoading(true);
    const { data: groupRows, error } = await supabase.from("contact_groups").select("id,name,description,color,created_at").eq("customer_id", customer.id).order("created_at", { ascending: false });
    if (error) notify("Could not load groups", false);
    const { data: links } = await supabase.from("contact_group_members").select("group_id,contact_id");
    // Counts reflect distinct contacts, so an accidental duplicate membership link
    // cannot inflate the recipient count shown to the user.
    const counts = (links || []).reduce((result, link) => {
      if (!result[link.group_id]) result[link.group_id] = new Set();
      result[link.group_id].add(link.contact_id);
      return result;
    }, {});
    setGroups((groupRows || []).map(group => ({ ...group, member_count: counts[group.id]?.size || 0 })));
    setGroupsLoading(false);
  }
  useEffect(() => { if (tab === "groups") loadGroups(); }, [tab, customer?.id]);

  async function createGroup() {
    const name = groupName.trim();
    if (!name) return;
    const { error } = await supabase.from("contact_groups").insert({ customer_id: customer.id, name, total_contacts: 0 });
    if (error) return notify("Could not create group", false);
    setGroupName(""); setShowGroupForm(false); notify("Contact list created"); loadGroups();
  }
  async function openGroup(group) {
    setActiveGroup(group); setSelectedContactId("");
    const { data: links, error } = await supabase.from("contact_group_members").select("id,contact_id").eq("group_id", group.id);
    if (error) return notify("Could not load group members", false);
    setMembers((links || []).map(link => ({ ...link, contact: (data || []).find(contact => contact.id === link.contact_id) })).filter(link => link.contact));
  }
  async function addMember() {
    if (!activeGroup || !selectedContactId) return;
    const { error } = await supabase.from("contact_group_members").insert({ group_id: activeGroup.id, contact_id: selectedContactId });
    if (error) return notify("Could not add contact to this list", false);
    notify("Contact added"); await openGroup(activeGroup); loadGroups();
  }
  async function removeMember(member) {
    const { error } = await supabase.from("contact_group_members").delete().eq("id", member.id).eq("group_id", activeGroup.id);
    if (error) return notify("Could not remove contact", false);
    notify("Contact removed"); await openGroup(activeGroup); loadGroups();
  }
  async function deleteGroup(group) {
    const { error } = await supabase.from("contact_groups").delete().eq("id", group.id).eq("customer_id", customer.id);
    if (error) return notify("Could not delete group", false);
    notify("Contact list deleted"); loadGroups();
  }

  return <div className="pad" style={{ padding: 28 }}>
    {toast && <div className="mono" style={{ position:"fixed",right:24,bottom:24,zIndex:2000,padding:"12px 16px",background:toast.ok?"#1A3A2A":"#7F1D1D",color:toast.ok?"var(--success-text)":"var(--error-text)",border:"1px solid var(--wire2)",fontSize:11 }}>{toast.text}</div>}
    <PageHead label="Database" title="Contacts." sub={loading ? "Loading..." : `${data?.length || 0} contacts`} action={tab === "groups" ? <button className="btn btn-gold" onClick={() => setShowGroupForm(true)}><Ic n="plus" s={12} c="var(--ink)" />New Group</button> : null} />
    <div style={{ display:"flex",borderBottom:"1px solid var(--wire)",marginBottom:20 }}>
      {[["contacts","All Contacts"],["groups","Contact Groups"]].map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{background:"none",border:"none",borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent",color:tab===id?"var(--gold2)":"var(--mist)",padding:"10px 18px",fontFamily:"DM Mono, monospace",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{label}</button>)}
    </div>
    {tab === "contacts" && <>
      <div style={{ position:"relative",marginBottom:16 }}><input className="input" placeholder="Search contacts..." value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="card"><div className="row th" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr",gap:12}}>{["Name","Phone","Tag","Added"].map(h => <div key={h}>{h}</div>)}</div>{loading?<Loader/>:!filtered.length?<Empty msg="No contacts found"/>:filtered.map(contact => <div key={contact.id} className="row" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr",gap:12}}><div style={{color:"var(--cream)",fontSize:13}}>{contact.name}</div><div style={{color:"var(--mist)",fontSize:12}}>{contact.phone_number}</div><div className="badge badge-cream">{contact.tag || "Contact"}</div><div style={{color:"var(--mist)",fontSize:11}}>{contact.created_at ? new Date(contact.created_at).toLocaleDateString() : "—"}</div></div>)}</div>
    </>}
    {tab === "groups" && (groupsLoading?<Loader/>:!groups.length?<Empty msg="No contact groups yet"/>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>{groups.map(group=><div key={group.id} className="card" style={{padding:"18px 20px"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:14}}><div><div style={{fontSize:13,fontWeight:600,color:"var(--cream)"}}>{group.name}</div>{group.description&&<div style={{fontSize:11,color:"var(--mist)"}}>{group.description}</div>}</div><div className="mono" style={{fontSize:10,color:"var(--gold2)"}}>{group.member_count} CONTACTS</div></div><div style={{display:"flex",gap:8}}><button className="btn btn-gold" style={{flex:1,fontSize:9,padding:"7px 10px"}} onClick={()=>openGroup(group)}>Manage</button><button className="btn btn-danger" style={{fontSize:9,padding:"7px 10px"}} onClick={()=>deleteGroup(group)}>Delete</button></div></div>)}</div>)}
    {showGroupForm && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div className="dialog-surface" style={{background:"var(--panel)",padding:28,width:"100%",maxWidth:440}}><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>NEW CONTACT LIST</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Create a group.</h3><label className="label">List name</label><input className="input" value={groupName} onChange={event=>setGroupName(event.target.value)} placeholder="e.g. VIP customers"/><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button className="btn btn-wire" onClick={()=>setShowGroupForm(false)}>Cancel</button><button className="btn btn-gold" onClick={createGroup} disabled={!groupName.trim()}>Create</button></div></div></div>}
    {activeGroup && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div className="dialog-surface" style={{background:"var(--panel)",padding:28,width:"100%",maxWidth:620,maxHeight:"80vh",overflow:"auto"}}><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT LIST</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>{activeGroup.name}</h3><div style={{display:"flex",gap:8,margin:"16px 0"}}><select className="input" value={selectedContactId} onChange={event=>setSelectedContactId(event.target.value)}><option value="">Select an existing contact…</option>{(data||[]).filter(contact=>!members.some(member=>member.contact_id===contact.id)).map(contact=><option key={contact.id} value={contact.id}>{contact.name} · {contact.phone_number}</option>)}</select><button className="btn btn-gold" onClick={addMember} disabled={!selectedContactId}>Add</button></div>{!members.length?<Empty msg="No contacts in this list yet"/>:<div className="card">{members.map(member=><div key={member.id} className="row" style={{gridTemplateColumns:"2fr 1.5fr 80px",gap:12}}><div style={{color:"var(--cream)",fontSize:13}}>{member.contact.name}</div><div style={{color:"var(--mist)",fontSize:12}}>{member.contact.phone_number}</div><button className="btn btn-wire" style={{fontSize:9,padding:"5px 8px"}} onClick={()=>removeMember(member)}>Remove</button></div>)}</div>}<div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-wire" onClick={()=>setActiveGroup(null)}>Done</button></div></div></div>}
  </div>;
}

// ── MESSAGE LOG ───────────────────────────────────────────────────────────────
function TeamInbox({ customer, user }) {
  const [filter, setFilter] = useState("all");
  const conversationEndpoint = filter === "mine" ? "/conversations?view=assigned_to_me" : filter === "unassigned" ? "/conversations?view=unassigned_human" : "/conversations";
  const { data: conversations, loading, error, refetch } = useAPI(conversationEndpoint, [customer?.id, filter]);
  const { data: members } = useAPI("/conversations/members", [customer?.id]);

  const [selectedId, setSelectedId] = useState("");
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    setSelectedId("");
    setThread(null);
    setThreadError("");
    setActionError("");
    setReply("");
  }, [customer?.id]);

  const openConversation = async (id) => {
    const request = ++requestRef.current;
    setSelectedId(id); setThread(null); setThreadError(""); setActionError(""); setReply(""); setThreadLoading(true);
    try {
      const response = await apiFetch(`${API}/conversations/${id}`);
      const payload = await response.json();
      if (request !== requestRef.current) return;
      setThread(payload);
      await apiFetch(`${API}/conversations/${id}/read`, { method: "POST" });
      refetch();
    } catch (failure) {
      if (request === requestRef.current) setThreadError(failure?.message || "We could not load this conversation.");
    } finally {
      if (request === requestRef.current) setThreadLoading(false);
    }
  };

  const refreshThread = async (id = selectedId) => {
    if (!id) return;
    await openConversation(id);
  };

  const runAction = async (path, options = {}) => {
    if (!selectedId) return;
    setActionError("");
    try {
      const response = await apiFetch(`${API}/conversations/${selectedId}${path}`, {
        method: options.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const payload = await response.json();
      if (payload?.conversation) setThread((current) => current ? { ...current, conversation: payload.conversation } : current);
      await refetch();
      return payload;
    } catch (failure) {
      setActionError(failure?.message || "This action could not be completed.");
      return null;
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setReplying(true); setActionError("");
    try {
      await apiFetch(`${API}/conversations/${selectedId}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply })
      });
      setReply("");
      await refreshThread(selectedId);
      await refetch();
    } catch (failure) {
      setActionError(failure?.message || "We could not send this reply.");
    } finally {
      setReplying(false);
    }
  };

  const list = Array.isArray(conversations) ? conversations : [];
  const filtered = list.filter((conversation) => {
    if (filter === "unread") return Number(conversation.unread_count || 0) > 0;
    if (filter === "attention") return conversation.status === "needs_attention" && conversation.control_mode === "needs_attention";
    // The server has already derived these two views from the authenticated caller.
    if (filter === "mine" || filter === "unassigned") return true;
    if (filter === "resolved") return conversation.status === "resolved";
    return true;
  });
  const active = thread?.conversation;
  const canManageAssignment = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());
  const isHuman = active?.control_mode === "human" && active?.status !== "resolved";
  const isAssignedToMe = active?.assigned_user_id === user?.id;
  const assigneeName = (conversation) => (members || []).find((member) => member.id === conversation?.assigned_user_id)?.name || (members || []).find((member) => member.id === conversation?.assigned_user_id)?.email || "another team member";
  const labelFor = (conversation) => {
    if (conversation.status === "resolved") return "Resolved";
    if (conversation.control_mode === "needs_attention") return conversation.assigned_user_id ? `Assigned to ${assigneeName(conversation)}` : "Waiting for a team member";
    if (conversation.control_mode === "human") return conversation.assigned_user_id === user?.id ? "You're handling this conversation" : `Assigned to ${assigneeName(conversation)}`;
    return "Automation active";
  };

  return <div className="pad" style={{ padding: 28 }}>
    <PageHead label="Operations" title="Team Inbox." sub="Keep customer conversations in one secure workspace." />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {[["all","All"],["unread","Unread"],["attention","Needs Attention"],["mine","Assigned to Me"],["unassigned","Unassigned"],["resolved","Resolved"]].map(([id,label]) =>
        <button key={id} className={filter===id ? "btn btn-gold" : "btn btn-wire"} onClick={() => setFilter(id)} style={{ padding: "8px 10px", fontSize: 9 }}>{label}</button>
      )}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, .9fr) minmax(340px, 1.55fr) minmax(210px, .7fr)", gap: 14, alignItems: "stretch" }} className="team-inbox">
      <div className="card" style={{ minHeight: 540 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 1.5, padding: "14px 16px", borderBottom: "1px solid var(--wire)" }}>{filter === "all" ? "CONVERSATIONS" : filter.toUpperCase()}</div>
        {loading ? <Loader /> : error ? <div role="alert" style={{ padding: 16, color: "var(--error-text)", fontSize: 12 }}>We could not load conversations: {error}</div> : !filtered.length ? <Empty msg={list.length ? "No conversations match this filter" : "No conversations yet"} /> :
          filtered.map((conversation) => <button key={conversation.id} onClick={() => openConversation(conversation.id)} style={{ display: "block", width: "100%", border: "none", borderBottom: "1px solid var(--wire)", background: selectedId === conversation.id ? "rgba(184,146,42,.08)" : "transparent", color: "var(--cream)", textAlign: "left", padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.contacts?.name || conversation.contacts?.phone_number || "Unknown contact"}</strong>
              {Number(conversation.unread_count || 0) > 0 && <span className="badge badge-gold">{conversation.unread_count}</span>}
            </div>
            <div style={{ color: "var(--mist)", fontSize: 11, marginTop: 3 }}>{conversation.contacts?.phone_number || "No phone number"}</div>
            <div style={{ color: "var(--mist)", fontSize: 11, marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.last_message?.message_body || "No message preview"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 9, alignItems: "center" }}>
              <span className={conversation.status === "needs_attention" ? "badge badge-red" : conversation.status === "resolved" ? "badge badge-cream" : conversation.control_mode === "human" ? "badge badge-green" : "badge badge-blue"}>{labelFor(conversation)}</span>
              <span className="mono" style={{ color: "var(--mist)", fontSize: 9 }}>{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : "—"}</span>
            </div>
          </button>)}
      </div>

      <div className="card" style={{ minHeight: 540, display: "flex", flexDirection: "column" }}>
        {!selectedId ? <Empty msg="Select a conversation to view messages" /> : threadLoading ? <Loader /> : threadError ? <div role="alert" style={{ padding: 18, color: "var(--error-text)", fontSize: 12 }}>{threadError}</div> : !active ? <Empty msg="Conversation unavailable" /> : <>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--wire)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div><div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 600 }}>{active.contacts?.name || active.contacts?.phone_number || "Customer"}</div><div style={{ color: "var(--mist)", fontSize: 11, marginTop: 3 }}>{active.contacts?.phone_number || "No phone number"}</div></div>
            <span className={active.status === "needs_attention" ? "badge badge-red" : active.status === "resolved" ? "badge badge-cream" : active.control_mode === "human" ? "badge badge-green" : "badge badge-blue"}>{labelFor(active)}</span>
          </div>
          {actionError && <div role="alert" style={{ margin: 12, padding: 10, color: "var(--error-text)", border: "1px solid rgba(239,68,68,.3)", fontSize: 12 }}>{actionError}</div>}
          <div style={{ flex: 1, padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {(thread.messages || []).map((message) => <div key={message.id} style={{ alignSelf: message.direction === "outbound" ? "flex-end" : "flex-start", maxWidth: "80%", background: message.direction === "outbound" ? "rgba(184,146,42,.16)" : "rgba(255,255,255,.05)", border: "1px solid var(--wire)", padding: "10px 12px" }}>
              <div style={{ color: "var(--cream)", fontSize: 13, whiteSpace: "pre-wrap" }}>{message.message_body || "Unsupported message type"}</div>
              <div className="mono" style={{ color: "var(--mist)", fontSize: 9, marginTop: 7 }}>{message.direction === "outbound" ? "OUTBOUND" : "INBOUND"} · {message.status || "—"} · {message.created_at ? new Date(message.created_at).toLocaleString() : "—"}</div>
            </div>)}
          </div>
          <form onSubmit={sendReply} style={{ padding: 14, borderTop: "1px solid var(--wire)" }}>
            <textarea className="textarea" placeholder={isHuman ? "Write a reply…" : active?.status === "resolved" ? "Reopen this conversation before replying" : "Take this conversation before replying"} value={reply} disabled={!isHuman || replying} onChange={(event) => setReply(event.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10, alignItems: "center" }}>
              <span style={{ color: "var(--mist)", fontSize: 10 }}>{isHuman ? "Automation is paused. Replies are sent through this workspace’s WhatsApp number." : active?.control_mode === "needs_attention" ? "Automation is paused while this conversation needs attention." : "Take or reopen this conversation before replying."}</span>
              <button className="btn btn-gold" type="submit" disabled={!isHuman || !reply.trim() || replying}>{replying ? "Sending…" : "Send reply"}</button>
            </div>
          </form>
        </>}
      </div>

      <div className="card" style={{ padding: 18, minHeight: 540 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 1.5, marginBottom: 14 }}>CONVERSATION DETAILS</div>
        {!active ? <div style={{ color: "var(--mist)", fontSize: 12 }}>Choose a conversation to see contact details and controls.</div> : <>
          <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600 }}>{active.contacts?.name || "Unnamed contact"}</div>
          <div style={{ color: "var(--mist)", fontSize: 12, marginTop: 4 }}>{active.contacts?.phone_number || "No phone number"}</div>
          {active.contacts?.tag && <div className="badge badge-cream" style={{ marginTop: 10 }}>{active.contacts.tag}</div>}
          <div style={{ borderTop: "1px solid var(--wire)", margin: "18px 0", paddingTop: 16 }}>
            <div className="label">Conversation status</div>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600 }}>{labelFor(active)}</div>
            {active.control_mode === "needs_attention" && <div style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>Automation is paused while this conversation needs attention.</div>}
            {active.control_mode === "human" && active.status !== "resolved" && <div style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>Automation is paused.</div>}
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {active.control_mode === "automation" && active.status !== "resolved" && <button className="btn btn-wire" onClick={() => runAction("/handoff", { body: { reason: "Requested from Team Inbox" } })}>Request human attention</button>}
            {active.control_mode === "needs_attention" && (!active.assigned_user_id || active.assigned_user_id === user?.id) && <button className="btn btn-gold" onClick={() => runAction("/take")}>Take Conversation</button>}
            {active.status === "resolved" && <button className="btn btn-gold" onClick={() => runAction("/reopen")}>Reopen Conversation</button>}
            {active.control_mode === "human" && active.status !== "resolved" && (isAssignedToMe || canManageAssignment) && <button className="btn btn-wire" onClick={() => runAction("/resolve")}>Resolve Conversation</button>}
          </div>
          {canManageAssignment && active.status !== "resolved" && <div style={{ borderTop: "1px solid var(--wire)", marginTop: 18, paddingTop: 16 }}>
            <label className="label" htmlFor="conversation-assignee">Assign to</label>
            <select id="conversation-assignee" className="input" value={active.assigned_user_id || ""} onChange={(event) => runAction("/assignment", { method: "PATCH", body: { assigned_user_id: event.target.value || null } })}>
              <option value="">Waiting for a team member</option>
              {(members || []).map((member) => <option key={member.id} value={member.id}>{member.name || member.email || member.id} · {member.role}</option>)}
            </select>
          </div>}
        </>}
      </div>
    </div>
  </div>
}

// ── AUTOMATIONS ───────────────────────────────────────────────────────────────
function Automations({ customer }) {
  const { data, loading, refetch } = useAPI("/automations");
  const [form, setForm] = useState({ keyword: "", reply: "" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const add = async () => {
    if (!form.keyword||!form.reply) return;
    setSaving(true);
    try {
      await apiFetch(`${API}/automations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger_type:"keyword",trigger_value:form.keyword.toUpperCase().trim(),message_template:form.reply})});
      setForm({keyword:"",reply:""});
      refetch();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id,cur) => {
    await apiFetch(`${API}/automations/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:!cur})});
    refetch();
  };

  const keywords = (data||[]).filter(a=>a.trigger_type==="keyword");

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="Engine" title="Automations." sub="Keyword triggers and auto-replies" />
      <div className="card" style={{ padding: 22, marginBottom: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold2), transparent)", opacity: 0.3 }} />
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Add Keyword</div>
        <div className="automation-form" style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "flex-end" }}>
          <div><label className="label">Keyword</label><input className="input" placeholder="e.g. PRICING" value={form.keyword} onChange={e=>set("keyword",e.target.value)} /></div>
          <div><label className="label">Auto-reply</label><input className="input" placeholder="Message sent when keyword received" value={form.reply} onChange={e=>set("reply",e.target.value)} /></div>
          <button className="btn btn-gold" onClick={add} disabled={saving} style={{ padding:"11px 16px", alignSelf:"flex-end" }}>
            <Ic n="plus" s={12} c="var(--ink)" />{saving?"...":"Add"}
          </button>
        </div>
      </div>
      <div className="card">
        <div className="row th" style={{ gridTemplateColumns: "1fr 3fr 100px 80px", gap: 12 }}>
          {["Keyword","Reply","Status",""].map(h=><div key={h}>{h}</div>)}
        </div>
        {loading ? <Loader /> : !keywords.length ? <Empty msg="No keywords yet" /> :
          keywords.map((k,i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: "1fr 3fr 100px 80px", gap: 12 }}>
              <div className="kw-tag"><span className="mono" style={{ fontSize: 11, color: "var(--gold2)" }}>{k.trigger_value}</span></div>
              <div style={{ fontSize: 12, color: "var(--mist)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.message_template}</div>
              <div className={`badge ${k.is_active?"badge-green":"badge-cream"}`}>{k.is_active?"Active":"Off"}</div>
              <button className="btn btn-wire" style={{ fontSize: 9, padding: "4px 10px" }} onClick={()=>toggle(k.id,k.is_active)}>{k.is_active?"Pause":"Enable"}</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings({ user, customer, onWorkspaceUpdated, onConnectionStateChange }) {
  const { data, loading, error, refetch } = useAPI("/workspace", [customer?.id]);
  const workspace = data?.workspace || customer || {};
  const role = data?.role || customer?.role || "member";
  const canEdit = ["owner", "admin"].includes(role);
  const onboarding = data?.onboarding || {
    account_complete: Boolean(user),
    email_verified: Boolean(user?.email_confirmed_at),
    business_profile_complete: Boolean(workspace.profile_completed_at),
    whatsapp_connected: Boolean(workspace.whatsapp_connected_at),
    onboarding_complete: workspace.onboarding_status === "complete",
    status: workspace.onboarding_status || "profile_incomplete"
  };
  const [form, setForm] = useState({
    business_name: "", contact_person: "", phone: "", country: "", industry: "", email: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [discoveryForm, setDiscoveryForm] = useState({ goals: [], team_size: "", contact_sources: [] });
  const [discoverySaving, setDiscoverySaving] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoverySaved, setDiscoverySaved] = useState(false);

  useEffect(() => {
    setForm({
      business_name: workspace.business_name || "",
      contact_person: workspace.contact_person || "",
      phone: workspace.phone || "",
      country: workspace.country || "",
      industry: workspace.industry || "",
      email: workspace.email || user?.email || ""
    });
  }, [workspace.id, workspace.business_name, workspace.contact_person, workspace.phone, workspace.country, workspace.industry, workspace.email, user?.email]);

  useEffect(() => {
    setDiscoveryForm({
      goals: Array.isArray(data?.discovery?.goals) ? data.discovery.goals : [],
      team_size: data?.discovery?.team_size || "",
      contact_sources: Array.isArray(data?.discovery?.contact_sources) ? data.discovery.contact_sources : []
    });
  }, [data?.discovery?.goals, data?.discovery?.team_size, data?.discovery?.contact_sources]);

  const updateField = (field, value) => {
    setSaved(false);
    setSaveError("");
    setForm(current => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const response = await apiFetch(`${API}/workspace/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      onWorkspaceUpdated?.(result.workspace);
      await refetch();
      setSaved(true);
    } catch (saveFailure) {
      setSaveError(saveFailure?.message || "We could not save the business profile.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscoveryChoice = (field, value) => {
    setDiscoverySaved(false);
    setDiscoveryError("");
    setDiscoveryForm((current) => ({
      ...current,
      [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value]
    }));
  };

  const saveDiscovery = async (event) => {
    event.preventDefault();
    if (!canEdit) return;
    setDiscoverySaving(true);
    setDiscoveryError("");
    setDiscoverySaved(false);
    try {
      await apiFetch(`${API}/workspace/discovery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discoveryForm)
      });
      await refetch();
      setDiscoverySaved(true);
    } catch (failure) {
      setDiscoveryError(failure?.message || "We could not save these setup details.");
    } finally {
      setDiscoverySaving(false);
    }
  };

  const goalOptions = [
    ["customer_support", "Customer Support"], ["marketing_promotions", "Marketing & Promotions"],
    ["customer_updates", "Customer Updates"], ["lead_follow_up", "Lead Follow-up"],
    ["appointments_reminders", "Appointments & Reminders"], ["payments_collections", "Payments & Collections"],
    ["orders", "Orders"], ["internal_notifications", "Internal Notifications"]
  ];
  const sourceOptions = [
    ["excel", "Excel"], ["google_sheets", "Google Sheets"], ["airtable", "Airtable"],
    ["phone_contacts", "Phone contacts"], ["pos", "POS"], ["crm", "CRM"], ["other", "Other"]
  ];

  const stages = [
    ["Account created", onboarding.account_complete],
    ["Email verified", onboarding.email_verified],
    ["Business profile complete", onboarding.business_profile_complete],
    [onboarding.whatsapp_connected ? "WhatsApp connected" : "WhatsApp not connected", onboarding.whatsapp_connected],
    ["Onboarding complete", onboarding.onboarding_complete]
  ];

  const fields = [
    ["business_name", "Business Name", "text", "Your registered business or trading name"],
    ["contact_person", "Contact Person", "text", "Who should ZedPing contact?"],
    ["phone", "Business Phone", "tel", "Business/support phone — separate from your WhatsApp API number"],
    ["country", "Country", "text", "e.g. Zambia"],
    ["industry", "Industry", "text", "e.g. Retail, Services, Hospitality"],
    ["email", "Business/Support Email", "email", "The email customers can use to contact your business"]
  ];

  return (
    <div className="pad" style={{ padding: 28, maxWidth: 720 }}>
      <PageHead label="Config" title="Business profile." sub="Keep your workspace details and onboarding progress up to date." />

      <div className="card-gold" style={{ padding: 22, marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Onboarding progress</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
          {stages.map(([label, complete]) => (
            <div key={label} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 12, color: complete ? "var(--cream)" : "var(--mist)" }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: complete ? "var(--gold)" : "rgba(255,255,255,0.08)", color: complete ? "var(--ink)" : "var(--mist)", fontSize: 10 }}>{complete ? "✓" : "○"}</span>
              {label}
            </div>
          ))}
        </div>
        
      </div>

      <WhatsAppConnection apiFetch={apiFetch} API={API} user={user} customer={workspace} onWorkspaceUpdated={onWorkspaceUpdated} onConnectionStateChange={onConnectionStateChange} />

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 6 }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase" }}>Business details</div>
          <div className="mono" style={{ fontSize: 9, color: canEdit ? "var(--gold2)" : "var(--mist)", letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
        </div>
        <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.6, margin: "0 0 20px" }}>
          {canEdit ? "Complete these details to prepare this workspace for WhatsApp connection." : "You can view this workspace profile. Only owners and admins can make changes."}
        </p>

        {loading ? <Loader /> : error ? <div role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>We could not load the latest profile: {error}</div> : (
          <form onSubmit={saveProfile}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {fields.map(([field, label, type, hint]) => (
                <div key={field}>
                  <label className="label" htmlFor={`profile-${field}`}>{label}</label>
                  <input
                    id={`profile-${field}`}
                    className="input"
                    type={type}
                    value={form[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    disabled={!canEdit || saving}
                    required
                    maxLength={field === "email" ? 254 : 160}
                    aria-describedby={`profile-${field}-hint`}
                    style={!canEdit ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                  />
                  <div id={`profile-${field}-hint`} style={{ color: "var(--mist)", fontSize: 10, marginTop: 5, lineHeight: 1.35 }}>{hint}</div>
                </div>
              ))}
            </div>
            {canEdit && <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <button className="btn btn-gold" type="submit" disabled={saving}>{saving ? "Saving…" : "Save business profile"}</button>
              {saved && <span role="status" style={{ color: "var(--success-text)", fontSize: 12 }}>Business profile saved.</span>}
              {saveError && <span role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>{saveError}</span>}
            </div>}
          </form>
        )}
      </div>

      {onboarding.business_profile_complete && <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 6 }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase" }}>Help us tailor ZedPing</div>
          <div className="mono" style={{ fontSize: 9, color: canEdit ? "var(--gold2)" : "var(--mist)", letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
        </div>
        <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.6, margin: "0 0 18px" }}>Tell us which jobs matter most. We’ll use this to suggest useful starter automations and setup steps for this workspace.</p>
        <form onSubmit={saveDiscovery}>
          <fieldset disabled={!canEdit || discoverySaving} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="label">What do you want ZedPing to help with?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {goalOptions.map(([value, label]) => <button key={value} type="button" onClick={() => toggleDiscoveryChoice("goals", value)} className={discoveryForm.goals.includes(value) ? "btn btn-gold" : "btn btn-wire"} style={{ padding: "8px 10px", fontSize: 9 }}>{label}</button>)}
            </div>
            <label className="label" htmlFor="team-size">Team size</label>
            <select id="team-size" className="input" value={discoveryForm.team_size} onChange={(event) => { setDiscoverySaved(false); setDiscoveryForm((current) => ({ ...current, team_size: event.target.value })); }} style={{ marginBottom: 18 }}>
              <option value="">Select team size</option><option value="1">1</option><option value="2-5">2–5</option><option value="6-10">6–10</option><option value="11-25">11–25</option><option value="25+">25+</option>
            </select>
            <label className="label">Where are your customer records today?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sourceOptions.map(([value, label]) => <button key={value} type="button" onClick={() => toggleDiscoveryChoice("contact_sources", value)} className={discoveryForm.contact_sources.includes(value) ? "btn btn-gold" : "btn btn-wire"} style={{ padding: "8px 10px", fontSize: 9 }}>{label}</button>)}
            </div>
          </fieldset>
          {canEdit && <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button className="btn btn-gold" type="submit" disabled={discoverySaving || !discoveryForm.goals.length || !discoveryForm.team_size}>{discoverySaving ? "Saving…" : "Save setup details"}</button>
            {discoverySaved && <span role="status" style={{ color: "var(--success-text)", fontSize: 12 }}>Setup details saved.</span>}
            {discoveryError && <span role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>{discoveryError}</span>}
          </div>}
        </form>
      </div>}

      <div className="card-gold" style={{ padding: 24 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Current plan</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="editorial" style={{ fontSize: 26, color: "var(--cream)", fontWeight: 600 }}>{(workspace.subscription_plan || "Starter").charAt(0).toUpperCase() + (workspace.subscription_plan || "starter").slice(1)}</div>
            <div style={{ fontSize: 12, color: "var(--mist)", marginTop: 3 }}>{workspace.subscription_status === "trial" ? "Free trial" : "Active subscription"}</div>
          </div>
          <a href={"https://wa.me/" + ZEDPING_WA + "?text=" + encodeURIComponent("Hi ZedPing! I'd like to upgrade my plan. Business: " + (workspace.business_name || "") + " | Current Plan: " + (workspace.subscription_plan || "Starter") + " | Email: " + (user?.email || ""))} target="_blank" rel="noopener noreferrer" className="btn btn-gold" style={{ padding: "9px 18px", fontSize: 10, textDecoration: "none" }}>Upgrade →</a>
        </div>
      </div>
    </div>
  );
}


// ── WHATSAPP TEMPLATES ───────────────────────────────────────────────────────
function TemplateComposer({ onSubmitted, onClose }) {
  const [draft, setDraft] = useState({ name: "", category: "UTILITY", language: "en_US", body: "", variable_examples: [], header_type: "none", header_text: "", footer_text: "", buttons: [] });
  const [headerFile, setHeaderFile] = useState(null);
  const [submission, setSubmission] = useState({ phase: "draft", message: "" });
  const rawVariables = [...new Set([...draft.body.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1])))];
  const variableKey = rawVariables.join(",");
  const malformedVariables = /{{|}}/.test(draft.body.replace(/{{\d+}}/g, "")) || rawVariables.some((number, index) => number !== index + 1);
  const mediaHeader = ["image", "document"].includes(draft.header_type);

  useEffect(() => { setDraft((current) => ({ ...current, variable_examples: rawVariables.map((_, index) => current.variable_examples[index] || "") })); }, [variableKey]);
  const update = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); if (submission.phase !== "draft") setSubmission({ phase: "draft", message: "" }); };
  const updateButton = (index, field, value) => update("buttons", draft.buttons.map((button, item) => item === index ? { ...button, [field]: value } : button));
  const preview = draft.body.replace(/{{(\d+)}}/g, (_, number) => draft.variable_examples[Number(number) - 1] || "{{" + number + "}}");
  const addButton = () => { if (draft.buttons.length < 3) update("buttons", [...draft.buttons, { type: "quick_reply", text: "" }]); };

  const submit = async (event) => {
    event.preventDefault();
    if (malformedVariables) return setSubmission({ phase: "error", message: "Use consecutive placeholders only: {{1}}, {{2}}, and so on." });
    if (mediaHeader && !headerFile) return setSubmission({ phase: "error", message: "Select the required header media file." });
    setSubmission({ phase: "submitting", message: "" });
    try {
      const form = new FormData();
      for (const field of ["name", "category", "language", "body", "header_type", "header_text", "footer_text"]) form.append(field, draft[field]);
      form.append("variable_examples", JSON.stringify(draft.variable_examples));
      form.append("buttons", JSON.stringify(draft.buttons));
      if (headerFile) form.append("header_media", headerFile);
      const response = await apiFetch(`${API}/templates`, { method: "POST", body: form });
      const created = await response.json();
      const status = String(created.template?.status || "PENDING").toUpperCase();
      setSubmission({ phase: status === "APPROVED" ? "approved" : status === "REJECTED" ? "rejected" : "pending", message: status === "APPROVED" ? "Meta approved this template." : status === "REJECTED" ? "Meta rejected this template." : "Submitted to Meta for review." });
      await onSubmitted(created);
    } catch (submitError) { setSubmission({ phase: "error", message: submitError?.message || "Meta could not accept this template." }); }
  };
  const stateColor = ["error", "rejected"].includes(submission.phase) ? "var(--error-text)" : submission.phase === "approved" ? "var(--success-text)" : submission.phase === "pending" ? "#FDE68A" : "var(--mist)";
  return <div className="card template-composer" style={{ padding: 22, marginBottom: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}><div><div className="editorial" style={{ color: "var(--cream)", fontSize: 25, fontWeight: 600 }}>Create WhatsApp template</div><div style={{ color: "var(--mist)", fontSize: 11, marginTop: 5 }}>Meta-ready headers, footer and buttons. ZedPing constructs the final Meta components securely.</div></div><button type="button" className="btn btn-wire" onClick={onClose}>Close</button></div>
    <form onSubmit={submit}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(140px,.7fr) minmax(130px,.55fr)", gap: 12 }}><div><label className="label">Template name</label><input className="input" value={draft.name} onChange={e=>update("name",e.target.value)} placeholder="booking_reminder" maxLength={100} required /></div><div><label className="label">Category</label><select className="input" value={draft.category} onChange={e=>update("category",e.target.value)}><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option></select></div><div><label className="label">Language</label><select className="input" value={draft.language} onChange={e=>update("language",e.target.value)}><option value="en_US">English (US)</option><option value="en_GB">English (UK)</option><option value="en">English</option></select></div></div>
      <div style={{ display:"grid",gridTemplateColumns:"minmax(160px,.55fr) minmax(0,1fr)",gap:12,marginTop:16 }}><div><label className="label">Header</label><select className="input" value={draft.header_type} onChange={e=>{update("header_type",e.target.value);setHeaderFile(null)}}><option value="none">No header</option><option value="text">Text</option><option value="image">Image</option><option value="document">Document (PDF)</option></select></div>{draft.header_type==="text"&&<div><label className="label">Header text</label><input className="input" value={draft.header_text} onChange={e=>update("header_text",e.target.value)} maxLength={60} required /></div>}{mediaHeader&&<div><label className="label">{draft.header_type==="image"?"Header image (JPEG/PNG, up to 10 MB)":"Header document (PDF, up to 10 MB)"}</label><input className="input" type="file" accept={draft.header_type==="image"?"image/jpeg,image/png":"application/pdf"} onChange={e=>setHeaderFile(e.target.files?.[0]||null)} required /></div>}</div>
      <div style={{ marginTop:16 }}><label className="label">Message body</label><textarea className="input" value={draft.body} onChange={e=>update("body",e.target.value)} placeholder="Hello {{1}}, your appointment is confirmed." maxLength={1024} required style={{minHeight:110,resize:"vertical",paddingTop:12}} /><div style={{color:malformedVariables?"var(--error-text)":"var(--mist)",fontSize:10,marginTop:6}}>{malformedVariables?"Placeholders must be consecutive.":"Use optional numbered placeholders: {{1}}, {{2}}."}</div></div>
      {!!rawVariables.length&&!malformedVariables&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginTop:12}}>{rawVariables.map((number,index)=><div key={number}><label className="label">Example for {"{{"+number+"}}"}</label><input className="input" value={draft.variable_examples[index]||""} onChange={e=>{const values=[...draft.variable_examples];values[index]=e.target.value;update("variable_examples",values)}} required maxLength={128}/></div>)}</div>}
      <div style={{marginTop:14}}><label className="label">Footer (optional)</label><input className="input" value={draft.footer_text} onChange={e=>update("footer_text",e.target.value)} maxLength={60} placeholder="Reply STOP to opt out" /></div>
      <div style={{marginTop:16,borderTop:"1px solid var(--wire)",paddingTop:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><label className="label">Buttons (optional)</label><button type="button" className="btn btn-wire" onClick={addButton} disabled={draft.buttons.length>=3}>Add button</button></div>{draft.buttons.map((button,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"150px minmax(130px,.6fr) minmax(0,1fr) auto",gap:8,marginTop:8}}><select className="input" value={button.type} onChange={e=>updateButton(index,"type",e.target.value)}><option value="quick_reply">Quick reply</option><option value="url">URL</option><option value="phone_number">Phone number</option></select><input className="input" value={button.text} onChange={e=>updateButton(index,"text",e.target.value)} placeholder="Button text" maxLength={25} required/>{button.type==="url"?<input className="input" value={button.url||""} onChange={e=>updateButton(index,"url",e.target.value)} placeholder="https://example.com" required/>:button.type==="phone_number"?<input className="input" value={button.phone_number||""} onChange={e=>updateButton(index,"phone_number",e.target.value)} placeholder="+260..." required/>:<div/>}<button type="button" className="btn btn-wire" onClick={()=>update("buttons",draft.buttons.filter((_,item)=>item!==index))}>Remove</button></div>)}</div>
      <div style={{marginTop:18,padding:14,background:"rgba(255,255,255,.025)",border:"1px solid var(--wire)"}}><div className="mono" style={{color:"var(--gold2)",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Live preview</div>{draft.header_type==="text"&&<div style={{color:"var(--cream)",fontWeight:600,marginBottom:8}}>{draft.header_text||"Header text"}</div>}{mediaHeader&&<div style={{color:"var(--mist)",fontSize:11,marginBottom:8}}>{headerFile?headerFile.name:`${draft.header_type} header media`}</div>}<div style={{color:"var(--cream)",whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.6}}>{preview||"Your message preview will appear here."}</div>{draft.footer_text&&<div style={{color:"var(--mist)",fontSize:11,marginTop:10}}>{draft.footer_text}</div>}{draft.buttons.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>{draft.buttons.map((button,index)=><span key={index} style={{border:"1px solid var(--wire2)",padding:"6px 10px",fontSize:11,color:"var(--gold2)"}}>{button.text||"Button"}</span>)}</div>}</div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginTop:16,flexWrap:"wrap"}}><button className="btn btn-gold" type="submit" disabled={submission.phase==="submitting"||malformedVariables}>{submission.phase==="submitting"?"Submitting…":"Submit to Meta"}</button><span className="mono" role={["error","rejected"].includes(submission.phase)?"alert":"status"} style={{color:stateColor,fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>{submission.phase==="draft"?"Draft locally":submission.message}</span></div>
    </form>
  </div>;
}

function WhatsAppTemplates({ customer }) {
  // This page mounts only after the user chooses it, so Meta is never queried
  // during dashboard/session restoration or while other pages are open.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API}/templates`);
      setData(await response.json());
    } catch (fetchError) {
      setError(fetchError?.message || "We could not load WhatsApp templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);
  const [selectedId, setSelectedId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [sendHeaderFile, setSendHeaderFile] = useState(null);
  const [result, setResult] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const canManageTemplates = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());

  const templates = data?.templates || [];
  const selected = templates.find((template) => String(template.id) === selectedId) || templates[0] || null;
  const approved = selected && String(selected.status || "").toUpperCase() === "APPROVED";
  const hasVariables = selected && /{{\s*\d+\s*}}/.test(JSON.stringify(selected.components || []));
  const body = selected?.components?.find((component) => String(component.type || "").toUpperCase() === "BODY")?.text;
  const mediaHeaderType = String(selected?.components?.find((component) => String(component.type || "").toUpperCase() === "HEADER")?.format || "").toLowerCase();
  const requiresMediaHeader = ["image", "document"].includes(mediaHeaderType);

  useEffect(() => {
    if (templates.length && !templates.some((template) => String(template.id) === selectedId)) {
      setSelectedId(String(templates[0].id));
    }
  }, [templates, selectedId]);

  const refresh = async () => {
    setResult(null);
    await refetch();
  };

  const onTemplateSubmitted = async (created) => {
    setResult({ ok: true, message: `Meta received “${created.template?.name || "your template"}”. The live list below is refreshed from Meta.` });
    await refetch();
  };

  const deleteTemplate = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setResult(null);
    try {
      const response = await apiFetch(`${API}/templates`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: String(deleteTarget.id) })
      });
      const removed = await response.json();
      setDeleteTarget(null);
      setSelectedId("");
      setResult({ ok: true, message: `Meta deleted “${removed.template?.name || deleteTarget.name}”. The live list was refreshed.` });
      await refetch();
    } catch (deleteError) {
      setResult({ ok: false, message: deleteError?.message || "Meta could not delete this template." });
    } finally {
      setDeleting(false);
    }
  };

  const send = async () => {
    if (!selected || !approved || hasVariables || !recipient.trim() || (requiresMediaHeader && !sendHeaderFile)) return;
    if (!window.confirm(`Send the approved template “${selected.name}” to ${recipient.trim()}? This sends a real WhatsApp message.`)) return;
    setSending(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("template_id", String(selected.id));
      form.append("to", recipient.trim());
      if (sendHeaderFile) form.append("header_media", sendHeaderFile);
      const response = await apiFetch(`${API}/templates/send`, { method: "POST", body: form });
      const sent = await response.json();
      setResult({ ok: true, message: `WhatsApp accepted “${sent.template?.name || selected.name}”.${sent.meta_message_id ? " Message ID recorded." : ""}` });
    } catch (sendError) {
      setResult({ ok: false, message: sendError?.message || "We could not send this template." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="WhatsApp" title="Message templates." sub="Live templates retrieved securely from your connected WhatsApp Business Account." />
      <div className="card" style={{ padding: 20, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Live Meta data</div>
          <div style={{ color: "var(--mist)", fontSize: 12 }}>{data?.connection?.display_name ? `Connected number: ${data.connection.display_name}` : "Templates are read directly from Meta."}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canManageTemplates && <button className="btn btn-gold" onClick={() => setShowComposer((current) => !current)} aria-expanded={showComposer}>{showComposer ? "Close composer" : "Create template"}</button>}
          <button className="btn btn-wire" onClick={refresh} disabled={loading} aria-label="Refresh WhatsApp templates">{loading ? "Refreshing…" : "Refresh templates"}</button>
        </div>
      </div>

      {showComposer && canManageTemplates && <TemplateComposer onClose={() => setShowComposer(false)} onSubmitted={onTemplateSubmitted} />}

      {loading ? <Loader /> : error ? <div className="card" role="alert" style={{ padding: 20, color: "var(--error-text)" }}>We could not load templates: {error}</div> : !templates.length ? (
        <div className="card" style={{ padding: 24, color: "var(--mist)" }}>No WhatsApp templates were returned for this workspace’s connected account.</div>
      ) : (
        <div className="template-layout" style={{ display: "grid", gridTemplateColumns: "minmax(250px, 0.9fr) minmax(0, 1.4fr)", gap: 16, alignItems: "start" }}>
          <div className="card" style={{ padding: 10 }}>
            {templates.map((template) => (
              <button key={template.id} onClick={() => { setSelectedId(String(template.id)); setResult(null); }} style={{ width: "100%", textAlign: "left", border: selected?.id === template.id ? "1px solid rgba(184,146,42,0.65)" : "1px solid transparent", background: selected?.id === template.id ? "rgba(184,146,42,0.08)" : "transparent", color: "var(--cream)", padding: 13, cursor: "pointer", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{template.name}</div>
                <div className="mono" style={{ color: "var(--mist)", fontSize: 9, letterSpacing: 1, marginTop: 5 }}>{template.category || "—"} · {template.language || "—"} · {template.status || "—"}</div>
              </button>
            ))}
          </div>

          {selected && <div className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 }}>
              <div>
                <div className="editorial" style={{ color: "var(--cream)", fontSize: 28, fontWeight: 600 }}>{selected.name}</div>
                <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 1.5, marginTop: 6 }}>{selected.category || "—"} · {selected.language || "—"} · {selected.status || "—"}</div>
              </div>
              <span className="mono" style={{ fontSize: 9, color: "var(--mist)" }}>Meta ID: {selected.id}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--wire)", padding: 14, color: "var(--mist)", fontSize: 12, lineHeight: 1.65, marginBottom: 18, whiteSpace: "pre-wrap" }}>
              {body || "This template has no text body. Its Meta components are shown below."}
            </div>
            <details style={{ marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", color: "var(--mist)", fontSize: 11 }}>View Meta components</summary>
              <pre style={{ color: "var(--mist)", fontSize: 10, overflowX: "auto", whiteSpace: "pre-wrap", marginTop: 10 }}>{JSON.stringify(selected.components || [], null, 2)}</pre>
            </details>

            {canManageTemplates && <div style={{ borderTop: "1px solid var(--wire)", paddingTop: 16, marginBottom: 18 }}>
              <button className="btn btn-wire" onClick={() => setDeleteTarget(selected)} style={{ color: "var(--error-text)", borderColor: "rgba(239,68,68,0.45)" }}>Delete template</button>
              <div style={{ color: "var(--mist)", fontSize: 10, marginTop: 7 }}>This permanently removes the template from Meta after confirmation.</div>
            </div>}

            {!approved ? <div role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>Only Meta-approved templates can be sent.</div> : hasVariables ? <div role="alert" style={{ color: "#FDE68A", fontSize: 12 }}>This template requires variables. This first review-ready version supports approved templates with no variables only.</div> : (
              <div style={{ borderTop: "1px solid var(--wire)", paddingTop: 18 }}>
                <label className="label" htmlFor="template-recipient">Test recipient number</label>
                <input id="template-recipient" className="input" placeholder="+260971234567" value={recipient} onChange={(event) => setRecipient(event.target.value)} disabled={sending} />
                {requiresMediaHeader && <div style={{ marginTop: 12 }}><label className="label">Required {mediaHeaderType} header media</label><input className="input" type="file" accept={mediaHeaderType === "image" ? "image/jpeg,image/png" : "application/pdf"} onChange={(event) => setSendHeaderFile(event.target.files?.[0] || null)} disabled={sending} required /></div>}
                <div style={{ color: "var(--mist)", fontSize: 10, marginTop: 7 }}>This sends a real WhatsApp template message after confirmation.</div>
                <button className="btn btn-gold" onClick={send} disabled={sending || !recipient.trim() || (requiresMediaHeader && !sendHeaderFile)} style={{ marginTop: 14 }}>{sending ? "Sending…" : "Send approved template"}</button>
              </div>
            )}
            {result && <div role={result.ok ? "status" : "alert"} style={{ color: result.ok ? "var(--success-text)" : "var(--error-text)", fontSize: 12, marginTop: 16 }}>{result.message}</div>}
          </div>}
        </div>
      )}

      {deleteTarget && <div role="dialog" aria-modal="true" aria-labelledby="delete-template-title" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.72)" }}>
        <div className="card" style={{ width: "min(460px, 100%)", padding: 24, border: "1px solid rgba(239,68,68,0.36)" }}>
          <div id="delete-template-title" className="editorial" style={{ color: "var(--cream)", fontSize: 28, fontWeight: 600 }}>Delete template?</div>
          <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>This will permanently remove <strong style={{ color: "var(--cream)" }}>{deleteTarget.name}</strong> from your WhatsApp Business Account in Meta. This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
            <button className="btn btn-wire" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
            <button className="btn btn-gold" onClick={deleteTemplate} disabled={deleting} style={{ background: "#B91C1C", borderColor: "#B91C1C" }}>{deleting ? "Deleting…" : `Delete “${deleteTarget.name}”`}</button>
          </div>
        </div>
      </div>}
    </div>
  );
}



// ── CONTENT LIBRARY ───────────────────────────────────────────────────────────
function ContentLibrary({ customer }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateError, setTemplateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", text_content: "", link_url: "", template_id: "" });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const canManage = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch(`${API}/content`);
      const result = await response.json();
      setItems(result.items || []);
    } catch (loadError) {
      setError(loadError?.message || "We could not load your Content Library.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const begin = async (nextType) => {
    setType(nextType); setActionError(""); setFile(null);
    setForm({ name: "", description: "", text_content: "", link_url: "", template_id: "" });
    if (nextType !== "WHATSAPP_TEMPLATE_REFERENCE" || templates.length) return;
    setTemplateError("");
    try {
      const response = await apiFetch(`${API}/templates`);
      const result = await response.json();
      setTemplates(result.templates || []);
    } catch (templateLoadError) {
      setTemplateError(templateLoadError?.message || "WhatsApp templates could not be loaded.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!type) return;
    setSaving(true); setActionError("");
    try {
      const body = new FormData();
      body.set("content_type", type);
      body.set("name", form.name);
      if (form.description) body.set("description", form.description);
      if (type === "TEXT") body.set("text_content", form.text_content);
      if (type === "LINK") body.set("link_url", form.link_url);
      if (type === "WHATSAPP_TEMPLATE_REFERENCE") body.set("template_id", form.template_id);
      if (["DOCUMENT", "IMAGE"].includes(type) && file) body.set("file", file);
      const response = await apiFetch(`${API}/content`, { method: "POST", body });
      const result = await response.json();
      setItems((current) => [result.item, ...current]);
      setSelected(result.item); setCreating(false); setType(null);
    } catch (submitError) {
      setActionError(submitError?.message || "We could not save this content.");
    } finally { setSaving(false); }
  };

  const archive = async (item) => {
    if (!window.confirm(`Archive “${item.name}”? It will no longer be available for new uses.`)) return;
    setActionError("");
    try {
      await apiFetch(`${API}/content/${item.id}/archive`, { method: "POST" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch (archiveError) { setActionError(archiveError?.message || "We could not archive this content."); }
  };

  const secureOpen = async (item) => {
    setActionError("");
    try {
      const response = await apiFetch(`${API}/content/${item.id}/download`);
      const result = await response.json();
      if (item.content_type === "IMAGE") setPreviewUrl(result.url);
      else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (openError) { setActionError(openError?.message || "We could not open this secure file."); }
  };

  const refreshTemplate = async (item) => {
    setActionError("");
    try {
      const response = await apiFetch(`${API}/content/${item.id}/refresh-template`, { method: "POST" });
      const result = await response.json();
      setItems((current) => current.map((entry) => entry.id === item.id ? result.item : entry));
      setSelected(result.item);
    } catch (refreshError) { setActionError(refreshError?.message || "We could not refresh this template reference."); }
  };

  const visible = items.filter((item) => (filter === "ALL" || item.content_type === filter) && item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filters = [["ALL", "All"], ["TEXT", "Text"], ["DOCUMENT", "Documents"], ["IMAGE", "Images"], ["LINK", "Links"], ["WHATSAPP_TEMPLATE_REFERENCE", "WhatsApp Templates"]];
  const icon = (contentType) => ({ TEXT: "✦", DOCUMENT: "▤", IMAGE: "▧", LINK: "↗", WHATSAPP_TEMPLATE_REFERENCE: "◌" }[contentType] || "•");
  const typeLabel = (contentType) => ({ TEXT: "Text", DOCUMENT: "Document", IMAGE: "Image", LINK: "Link", WHATSAPP_TEMPLATE_REFERENCE: "WhatsApp Template" }[contentType] || contentType);
  const preview = (item) => {
    if (item.content_type === "TEXT") return String(item.text_content || "").slice(0, 110);
    if (item.content_type === "DOCUMENT") return [item.mime_type?.split("/").pop()?.toUpperCase(), item.file_size ? `${Math.ceil(item.file_size / 1024)} KB` : null].filter(Boolean).join(" · ");
    if (item.content_type === "IMAGE") return item.mime_type?.replace("image/", "").toUpperCase() || "Image";
    if (item.content_type === "LINK") { try { return new URL(item.link_url).hostname; } catch (_) { return item.link_url; } }
    return [item.template_status, item.template_language].filter(Boolean).join(" · ");
  };

  return <div className="pad" style={{ padding: 28 }}>
    <PageHead label="Reusable content" title="Content Library." sub="Save messages, documents, images and links once, then reuse them across ZedPing." action={canManage ? <button className="btn btn-gold" onClick={() => { setCreating(true); setType(null); setActionError(""); }}><Ic n="plus" s={13} c="var(--ink)" /> Add Content</button> : null} />
    {actionError && <div className="card" role="alert" style={{ padding: 13, marginBottom: 16, color: "var(--error-text)" }}>{actionError}</div>}
    <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>{filters.map(([key, label]) => <button key={key} className={filter === key ? "btn btn-gold" : "btn btn-wire"} onClick={() => setFilter(key)} style={{ padding: "7px 10px", fontSize: 10 }}>{label}</button>)}</div>
      <input className="input" aria-label="Search Content Library" placeholder="Search content" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 210 }} />
    </div>
    {loading ? <Loader /> : error ? <div className="card" role="alert" style={{ padding: 20, color: "var(--error-text)" }}>{error}</div> : !visible.length ? <div className="card" style={{ padding: 28, color: "var(--mist)", textAlign: "center" }}>No content saved here yet.{canManage ? " Add a reusable message, file, link or WhatsApp template reference." : ""}</div> : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(270px, .8fr)", gap: 16 }}>
      <div className="card" style={{ overflow: "hidden" }}>{visible.map((item) => <button key={item.id} onClick={() => setSelected(item)} style={{ width: "100%", textAlign: "left", background: selected?.id === item.id ? "rgba(196,154,61,.08)" : "transparent", border: 0, borderBottom: "1px solid var(--wire)", padding: "15px 17px", cursor: "pointer", color: "inherit", display: "flex", gap: 12 }}>
        <div style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--wire2)", color: "var(--gold2)", flexShrink: 0 }}>{icon(item.content_type)}</div>
        <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--cream)", fontWeight: 600, fontSize: 13 }}>{item.name}</div><div style={{ color: "var(--mist)", fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview(item)}</div></div>
        <span className="mono" style={{ color: "var(--gold2)", fontSize: 8, letterSpacing: 1, alignSelf: "center" }}>{typeLabel(item.content_type)}</span>
      </button>)}</div>
      <div className="card" style={{ padding: 20, minHeight: 230 }}>{!selected ? <div style={{ color: "var(--mist)", fontSize: 12 }}>Choose an item to view its details.</div> : <>
        <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 1.5 }}>{typeLabel(selected.content_type)}</div><h3 className="editorial" style={{ color: "var(--cream)", fontSize: 21, marginTop: 7 }}>{selected.name}</h3>
        {selected.description && <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>{selected.description}</p>}
        {selected.content_type === "TEXT" && <div style={{ whiteSpace: "pre-wrap", color: "var(--cream2)", fontSize: 12, lineHeight: 1.55, marginTop: 15 }}>{selected.text_content}</div>}
        {selected.content_type === "LINK" && <a href={selected.link_url} target="_blank" rel="noreferrer" style={{ color: "var(--gold2)", display: "block", fontSize: 12, marginTop: 15, wordBreak: "break-all" }}>{selected.link_url}</a>}
        {["DOCUMENT","IMAGE"].includes(selected.content_type) && <><button className="btn btn-wire" onClick={() => secureOpen(selected)} style={{ marginTop: 16 }}>{selected.content_type === "IMAGE" ? "Preview secure image" : "Open secure document"}</button>{selected.content_type === "IMAGE" && previewUrl && <img src={previewUrl} alt={selected.name} style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "contain", marginTop: 14, border: "1px solid var(--wire)" }} />}</>}
        {selected.content_type === "WHATSAPP_TEMPLATE_REFERENCE" && <><div style={{ color: "var(--cream2)", fontSize: 12, marginTop: 15 }}>{selected.template_name} · {selected.template_language || "language unavailable"} · {selected.template_status || "status unavailable"}</div>{canManage && <button className="btn btn-wire" onClick={() => refreshTemplate(selected)} style={{ marginTop: 13 }}>Refresh from Meta</button>}</>}
        {canManage && <button className="btn btn-wire" onClick={() => archive(selected)} style={{ marginTop: 18, color: "var(--error-text)", borderColor: "rgba(239,68,68,.35)" }}>Archive content</button>}
      </>}</div>
    </div>}

    {creating && <div className="modal-bg"><div className="modal" style={{ maxWidth: 620 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2 }}>CONTENT LIBRARY</div><h3 className="editorial" style={{ color: "var(--cream)", fontSize: 24, marginTop: 7 }}>{type ? "Add " + typeLabel(type) : "What would you like to save?"}</h3></div><button className="btn btn-wire" onClick={() => { setCreating(false); setType(null); }}>Close</button></div>
      {!type ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>{[["TEXT","Text"],["DOCUMENT","Document"],["IMAGE","Image"],["LINK","Link"],["WHATSAPP_TEMPLATE_REFERENCE","WhatsApp Template"]].map(([key,label]) => <button key={key} className="btn btn-wire" onClick={() => begin(key)} style={{ minHeight: 72, justifyContent: "center" }}>{label}</button>)}</div> :
      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <label className="label">Name</label><input className="input" required maxLength="160" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Give this content a clear name" />
        <label className="label" style={{ marginTop: 13 }}>Description <span style={{ color: "var(--mist)" }}>optional</span></label><input className="input" maxLength="500" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A short note for your team" />
        {type === "TEXT" && <><label className="label" style={{ marginTop: 13 }}>Content</label><textarea className="textarea" required maxLength="20000" value={form.text_content} onChange={(event) => setForm((current) => ({ ...current, text_content: event.target.value }))} placeholder="Write reusable information for your team" /><div style={{ color: "var(--mist)", fontSize: 10, textAlign: "right" }}>{form.text_content.length}/20,000</div></>}
        {type === "LINK" && <><label className="label" style={{ marginTop: 13 }}>Destination URL</label><input className="input" type="url" required value={form.link_url} onChange={(event) => setForm((current) => ({ ...current, link_url: event.target.value }))} placeholder="https://…" /></>}
        {["DOCUMENT","IMAGE"].includes(type) && <><label className="label" style={{ marginTop: 13 }}>{type === "IMAGE" ? "Image file" : "Document file"}</label><input className="input" type="file" required accept={type === "IMAGE" ? "image/jpeg,image/png,image/webp" : ".pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"} onChange={(event) => setFile(event.target.files?.[0] || null)} /><div style={{ color: "var(--mist)", fontSize: 10, marginTop: 6 }}>Allowed types only, up to 10 MB. Files stay private to this workspace.</div></>}
        {type === "WHATSAPP_TEMPLATE_REFERENCE" && <><label className="label" style={{ marginTop: 13 }}>Live WhatsApp template</label>{templateError ? <div role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>{templateError}</div> : <select className="input" required value={form.template_id} onChange={(event) => setForm((current) => ({ ...current, template_id: event.target.value }))}><option value="">Choose a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.status} · {template.language}</option>)}</select>}<div style={{ color: "var(--mist)", fontSize: 10, marginTop: 6 }}>This saves a validated reference, not a copy of the Meta template.</div></>}
        {actionError && <div role="alert" style={{ color: "var(--error-text)", fontSize: 12, marginTop: 13 }}>{actionError}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 10 }}><button type="button" className="btn btn-wire" onClick={() => setType(null)}>Back</button><button type="submit" className="btn btn-gold" disabled={saving || (type === "WHATSAPP_TEMPLATE_REFERENCE" && !!templateError)}>{saving ? (["DOCUMENT","IMAGE"].includes(type) ? "Uploading…" : "Saving…") : "Save content"}</button></div>
      </form>}
    </div></div>}
  </div>
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const invitationTokenRef = useRef(pendingInvitationToken());
  const invitationValidityRef = useRef(invitationTokenRef.current ? "pending" : "none");
  const invitationPreviewRef = useRef(Promise.resolve());
  const authLoadRef = useRef(null);
  const [view, setView] = useState(invitationTokenRef.current || window.location.search.includes("signup") ? "signup" : "login");
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceChanging, setWorkspaceChanging] = useState(false);
  const [workspaceSwitchTarget, setWorkspaceSwitchTarget] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [active, setActive] = useState("overview");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationTokenRef.current));
  const [whatsappConnectionState, setWhatsAppConnectionState] = useState(null);
  const [reset, setReset] = useState(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    return hash.includes("type=recovery") || search.includes("type=recovery") || (hash.includes("access_token") && hash.includes("recovery"));
  });

  useEffect(() => {
    const token = invitationTokenRef.current;
    if (!token) { setInvitationLoading(false); return; }
    let cancelled = false;
    const preview = previewInvitation(token)
      .then(context => {
        invitationValidityRef.current = "valid";
        emitInvitationAuthDiagnostic("invitation_previewed");
        if (!cancelled) setInvitation(context);
      })
      .catch(error => {
        // A revoked/expired link must never keep an authenticated user trapped
        // in invitation acceptance. Remove this unusable capability and permit
        // the normal workspace loader to continue.
        invitationValidityRef.current = "invalid";
        invitationTokenRef.current = null;
        clearPendingInvitationToken();
        removeInvitationFragment();
        if (!cancelled) setAuthError(error?.message || "This invitation is no longer available.");
      })
      .finally(() => { if (!cancelled) setInvitationLoading(false); });
    invitationPreviewRef.current = preview;
    return () => { cancelled = true; };
  }, []);

  const loadAuthenticatedContext = useCallback((sessionUser) => {
    if (authLoadRef.current?.userId === sessionUser.id && authLoadRef.current.promise) return authLoadRef.current.promise;
    const task = (async () => {
      try {
        setAuthError(""); setUser(sessionUser);
        if (!sessionUser.email_confirmed_at) {
          emitInvitationAuthDiagnostic("email_unverified");
          setCustomer(null); setWorkspaces([]); setNeedsVerification(true); setWorkspaceChanging(false); setWorkspaceSwitchTarget(null); return;
        }
        setWorkspaceChanging(true);
        // Wait for the capability preview before deciding whether there is an
        // invitation to accept. This stops an old or revoked fragment from
        // racing normal session/workspace restoration.
        await invitationPreviewRef.current;
        const token = invitationValidityRef.current === "valid" ? invitationTokenRef.current : null;
        if (token) emitInvitationAuthDiagnostic("accept_attempted");
        const acceptedInvitation = token ? await acceptInvitationToken(token) : null;
        if (acceptedInvitation) { invitationTokenRef.current = null; setInvitation(null); }
        const { workspaces: authorizedWorkspaces, ownedWorkspace } = await getAuthorizedWorkspaces(sessionUser);
        if (!authorizedWorkspaces.length) throw new Error("No workspace is available for this account. Please contact support.");
        const storedId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        const selected = authorizedWorkspaces.find(workspace => workspace.id === acceptedInvitation?.workspace_id) || authorizedWorkspaces.find(workspace => workspace.id === storedId) || authorizedWorkspaces.find(workspace => workspace.id === ownedWorkspace?.id) || authorizedWorkspaces[0];
        setWorkspaces(authorizedWorkspaces);
        const verified = await verifyWorkspaceSelection(authorizedWorkspaces, selected.id);
        setWorkspaces(current => current.map(item => item.id === verified.workspace.id ? verified.workspace : item));
        setCustomer(verified.workspace); setNeedsVerification(false); setActive("overview"); setWorkspaceSwitchTarget(null); setWorkspaceChanging(false);
      } catch (error) {
        console.error("Workspace loading failed", error);
        // Keep the active Auth identity. Clearing it while a Supabase session
        // remains triggers another auth callback and caused the redirect loop.
        setCustomer(null); setWorkspaces([]); setNeedsVerification(false); setWorkspaceSwitchTarget(null); setWorkspaceChanging(false);
        setAuthError(error?.message || "We could not load your workspace. Please try again or contact support.");
      }
    })();
    authLoadRef.current = { userId: sessionUser.id, promise: task };
    task.finally(() => { if (authLoadRef.current?.promise === task) authLoadRef.current = null; });
    return task;
  }, []);;

  useEffect(() => {
    const restoreSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const type = params.get("type");

      if (code || type === "recovery") {
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setAuthError(error.message || "We could not verify this link.");
        } else if (data?.session && type === "recovery") {
          setReset(true);
          setUser(null);
          window.history.replaceState(null, "", window.location.pathname);
        }
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session?.user) {
        emitInvitationAuthDiagnostic("initial_session");
        await loadAuthenticatedContext(session.user);
      } else {
        emitInvitationAuthDiagnostic("no_session");
      }
      setLoading(false);
    };

    restoreSession().catch((error) => {
      console.error("Session lookup failed", error);
      setAuthError("We could not restore your session. Please sign in again.");
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReset(true);
        setUser(null);
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
      if (event === "INITIAL_SESSION") emitInvitationAuthDiagnostic(session?.user ? "initial_session" : "no_session");
      if (event === "SIGNED_IN") emitInvitationAuthDiagnostic("signed_in");
      if (session?.user) {
        window.setTimeout(() => { loadAuthenticatedContext(session.user); }, 0);
      } else {
        setUser(null);
        setCustomer(null);
        setWorkspaces([]);
        setNeedsVerification(false);
        setWorkspaceChanging(false);
        setWorkspaceSwitchTarget(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadAuthenticatedContext]);

  useEffect(() => {
    const handleWorkspaceForbidden = async () => {
      setWorkspaceChanging(true);
      setCustomer(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await loadAuthenticatedContext(session.user);
    };
    window.addEventListener("zedping:workspace-forbidden", handleWorkspaceForbidden);
    return () => window.removeEventListener("zedping:workspace-forbidden", handleWorkspaceForbidden);
  }, [loadAuthenticatedContext]);

  const onWorkspaceChange = async (workspaceId) => {
    if (workspaceChanging || workspaceId === customer?.id) return;
    const nextWorkspace = workspaces.find(workspace => workspace.id === workspaceId);
    if (!nextWorkspace) {
      setAuthError("That workspace is not available to this account.");
      return;
    }

    setAuthError("");
    setWorkspaceChanging(true);
    setWorkspaceSwitchTarget(nextWorkspace.id);
    setCustomer(null);
    setActive("overview");
    setOpen(false);

    try {
      const verified = await verifyWorkspaceSelection(workspaces, nextWorkspace.id);
      setWorkspaces((current) => current.map((item) => item.id === verified.workspace.id ? verified.workspace : item));
      setCustomer(verified.workspace);
    } catch (switchError) {
      try {
        const { workspaces: refreshed } = await getAuthorizedWorkspaces(user);
        if (!refreshed.length) throw switchError;
        const verified = await verifyWorkspaceSelection(refreshed, refreshed[0].id);
        setWorkspaces(refreshed.map((item) => item.id === verified.workspace.id ? verified.workspace : item));
        setCustomer(verified.workspace);
        setAuthError("Your previous workspace access changed, so we selected an available workspace.");
      } catch (refreshError) {
        window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        setWorkspaces([]);
        setCustomer(null);
        setAuthError("Your workspace access could not be verified. Please sign in again or contact support.");
      }
    } finally {
      setWorkspaceSwitchTarget(null);
      setWorkspaceChanging(false);
    }
  };

  const onWorkspaceUpdated = (workspace) => {
    if (!workspace?.id) return;
    setCustomer((current) => current?.id === workspace.id ? { ...current, ...workspace } : current);
    setWorkspaces((current) => current.map((item) => item.id === workspace.id ? { ...item, ...workspace } : item));
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setUser(null); setCustomer(null); setWorkspaces([]); setNeedsVerification(false); setWorkspaceChanging(false); setWorkspaceSwitchTarget(null); setActive("overview");
  };

  const updateWhatsAppConnectionState = (nextState) => {
    const next = { workspaceId: customer?.id, ...nextState };
    setWhatsAppConnectionState((current) =>
      current?.workspaceId === next.workspaceId && current?.phase === next.phase && current?.message === next.message
        ? current
        : next
    );
  };

  const pages = {
    overview:    { title: "Overview",     comp: <Overview customer={customer} user={user} onNavigate={setActive} whatsappConnectionState={whatsappConnectionState?.workspaceId === customer?.id ? whatsappConnectionState : null} /> },
    broadcasts:  { title: "Broadcasts",   comp: <Broadcasts customer={customer} /> },
    contacts:    { title: "Contacts",     comp: <Contacts customer={customer} /> },
    messages:    { title: "Team Inbox",   comp: <TeamInbox customer={customer} user={user} /> },
    automations: { title: "Automations",  comp: <Automations customer={customer} /> },
    templates:   { title: "WhatsApp Templates", comp: <WhatsAppTemplates customer={customer} /> },
    content:     { title: "Content Library", comp: <ContentLibrary customer={customer} /> },
    team:        { title: "Team Members", comp: <TeamMembers customer={customer} apiFetch={apiFetch} /> },
    settings:    { title: "Account",      comp: <Settings user={user} customer={customer} onWorkspaceUpdated={onWorkspaceUpdated} onConnectionStateChange={updateWhatsAppConnectionState} /> },
  };

  if (loading || invitationLoading) return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{css}</style>
      <div className="spin" style={{ width: 24, height: 24 }} />
      <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>Loading</div>
    </div>
  );

  if (reset) return <><style>{css}</style><ResetPass onDone={() => setReset(false)} /></>;
  if (needsVerification && user) return <><style>{css}</style><VerifyEmail user={user} onLogout={onLogout} invitation={invitation} /></>;

  if (!user) return (
    <>
      <style>{css}</style>
      {authError && <div className="mono" role="alert" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, maxWidth: 520, padding: "10px 14px", background: "var(--panel)", border: "1px solid rgba(239,68,68,0.35)", color: "var(--error-text)", fontSize: 10, letterSpacing: 0.5, textAlign: "center" }}>{authError}</div>}
      {view === "signup" ? <SignUp onSwitch={() => setView("login")} onAuth={loadAuthenticatedContext} invitation={invitation} /> : <Login onSwitch={() => setView("signup")} onAuth={loadAuthenticatedContext} invitation={invitation} />}
    </>
  );

  const cur = pages[active];

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} user={user} customer={customer} onLogout={onLogout} open={open} onClose={() => setOpen(false)} />
        <div className="main workspace">
          <MobTopbar onMenu={() => setOpen(true)} onLogout={onLogout} workspaces={workspaces} activeWorkspaceId={customer?.id || workspaceSwitchTarget} onWorkspaceChange={onWorkspaceChange} switching={workspaceChanging} />
          <Topbar title={cur.title} user={user} customer={customer} workspaces={workspaces} onWorkspaceChange={onWorkspaceChange} activeWorkspaceId={customer?.id || workspaceSwitchTarget} switching={workspaceChanging} />
          {workspaceChanging ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }} role="status" aria-live="polite"><div className="spin" style={{ width: 24, height: 24 }} /><div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Loading workspace</div></div> : <div key={customer?.id} style={{ flex: 1, overflowY: "auto" }}>{cur.comp}</div>}
        </div>
      </div>
    </>
  );
}
