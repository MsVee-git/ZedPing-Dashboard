// @ts-nocheck
// Contact-group bulk selection is intentionally rendered from this existing
// workspace-scoped Contacts surface; it does not introduce a parallel store.
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { BroadcastDetails } from "./BroadcastDetails";
import { ConversationHandlingStatus } from "./ConversationHandlingStatus";
import { MarketingOptOutBadge, BroadcastReviewSummary } from "./MarketingConsent";
import { WhatsAppConnection } from "./WhatsAppConnection";
import { ChatbotFlows } from "./ChatbotFlows";
import { ZoeAI } from "./ZoeAI";
import { TeamMembers } from "./TeamMembers";
import { ContactsImport } from "./ContactsImport";
import { provisionWorkspaceWithGateway } from "./lib/workspaceProvisioning";
import { captureInvitationToken, clearInvitationToken } from "./lib/invitationFlow";
import { emitInvitationAuthDiagnostic } from "./lib/invitationDiagnostics";
import { invitationAccountState } from "./lib/invitationIdentity";
import { parseDashboardRoute, routeToPath, safeParentRoute, isResourceRoute } from "./lib/dashboardRouting";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://zzhqhgeyxbdqdkacrviq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHFoZ2V5eGJkcWRrYWNydmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMwNDEsImV4cCI6MjA5NDU3OTA0MX0.C4xDheJF3qOB7L3LWZKryNgE4-eMc05kJi4qwDhp-sI";
const API = "https://zedping-backend-production.up.railway.app";
const ZEDPING_WA = "260778621167";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const WORKSPACE_STORAGE_KEY = "zedping.activeWorkspaceId";
const nativeRequest = window.fetch.bind(window);

// Customer-facing number labels must come from the connected telephone number,
// never the internal Meta Phone Number ID.
function connectedWhatsAppNumberLabel(number) {
  const phone = typeof number?.display_phone_number === "string" ? number.display_phone_number.trim() : "";
  if (!phone) return "Connected WhatsApp number";
  const name = typeof number?.display_name === "string" ? number.display_name.trim() : "";
  return name ? `${name} — ${phone}` : phone;
}

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

  /* Modal */
  .modal-bg { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,0.72); backdrop-filter: blur(5px); }
  .modal { width: min(680px, 100%); padding: 24px; background: var(--panel); border: 1px solid var(--wire2); box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
  @media (max-width: 768px) { .modal-bg { align-items: flex-start; overflow-y: auto; padding: 12px; } .modal { margin: 0; padding: 18px; } }

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
    flow: "M7 3v4 M7 7h10 M17 7v4 M17 11H7 M7 11v4 M7 15h10 M17 15v4 M7 21v-2 M17 21v-2",
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
    file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M8 13h8 M8 17h8",
    image: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z M8 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3 M2 17l5-5 4 4 3-3 8 7",
    link: "M10 13a5 5 0 007.07.07l2-2a5 5 0 00-7.07-7.07l-1.15 1.15 M14 11a5 5 0 00-7.07-.07l-2 2A5 5 0 0012 20l1.15-1.15",
    template: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
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
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 22, lineHeight: 1.7 }}>{invited ? "You’ve been invited to join ZedPing. Create your account to get started. After email verification, your invitation will resume automatically." : "Build smarter customer communication with ZedPing."}</p>
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


// ── INVITATION ACCOUNT MISMATCH ──────────────────────────────────────────────
function InvitationAccountMismatch({ invitation, onSignOut }) {
  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>WORKSPACE INVITATION</div>
        <h2 className="editorial" style={{ fontSize: 34, color: "var(--cream)", marginBottom: 10, letterSpacing: -0.5, fontWeight: 600 }}>You’re signed in with a different ZedPing account.</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 20 }}>This invitation was sent to <strong style={{ color: "var(--cream2)", overflowWrap: "anywhere" }}>{invitation.email}</strong>. Sign out and continue with the invited account to join this workspace.</p>
        <button type="button" className="btn btn-gold" onClick={onSignOut} style={{ width: "100%", padding: "13px", fontSize: 11 }}>Sign out and continue →</button>
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
    { id: "contactGroups", label: "Contact Groups", icon: "contacts" },
    { id: "messages", label: "Team Inbox", icon: "messages" },
    { id: "automations", label: "Automations", icon: "auto" },
    { id: "chatbotFlows", label: "Chatbot Flows", icon: "flow" },
    { id: "zoeAi", label: "Zoe AI", icon: "auto" },
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
function Broadcasts() {
  const { data: history, loading: historyLoading, refetch: refetchHistory } = useAPI("/broadcasts/scheduled");
  const { data: setup, loading: setupLoading, error: setupError } = useAPI("/broadcasts/setup");
  const [numberId, setNumberId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [mappings, setMappings] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [review, setReview] = useState(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityId, setActivityId] = useState(null);

  const selectedTemplate = templates.find((item) => String(item.id) === String(templateId));
  const loadTemplates = async () => {
    if (!numberId) return;
    setLoadingTemplates(true); setNotice(null); setReview(null); setTemplateId(""); setMappings({});
    try {
      const response = await apiFetch(`${API}/broadcasts/templates?whatsapp_number_id=${encodeURIComponent(numberId)}`);
      setTemplates((await response.json()).templates || []);
    } catch (error) { setTemplates([]); setNotice({ ok: false, text: error.message || "Could not load templates." }); }
    finally { setLoadingTemplates(false); }
  };
  useEffect(() => { if (numberId) loadTemplates(); else { setTemplates([]); setTemplateId(""); } }, [numberId]);
  useEffect(() => { setReview(null); }, [groupId, templateId, mappings]);
  const updateMapping = (number, source, value = "") => setMappings((current) => ({ ...current, [number]: { source, ...(source === "fixed" ? { value } : {}) } }));
  const reviewBroadcast = async () => {
    if (!numberId || !groupId || !templateId) return setNotice({ ok: false, text: "Choose a WhatsApp number, Contact Group and approved template." });
    setSending(true); setNotice(null);
    try {
      const response = await apiFetch(`${API}/broadcasts/review-template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsapp_number_id: numberId, contact_group_id: groupId, template_id: templateId, variable_mappings: mappings }) });
      setReview(await response.json());
    } catch (error) { setNotice({ ok: false, text: error.message || "Could not prepare the broadcast review." }); }
    finally { setSending(false); }
  };
  const send = async () => {
    setSending(true); setNotice(null);
    try {
      const response = await apiFetch(`${API}/broadcasts/send-template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsapp_number_id: numberId, contact_group_id: groupId, template_id: templateId, variable_mappings: mappings }) });
      const result = await response.json(); setNotice({ ok: true, text: `Broadcast submitted: ${result.accepted} accepted · ${result.failed} failed` }); setReview(null); refetchHistory();
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
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>New Broadcast</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {setupError && <div className="mono" style={{ color: "var(--error-text)", fontSize: 11 }}>{setupError}</div>}
          <div><label className="label">Sending WhatsApp number</label><select className="input" value={numberId} onChange={event => setNumberId(event.target.value)} disabled={setupLoading}><option value="">Select a connected number…</option>{(setup?.numbers || []).map(number => <option key={number.id} value={number.id}>{connectedWhatsAppNumberLabel(number)}</option>)}</select></div>
          <div><label className="label">Contact Group</label><select className="input" value={groupId} onChange={event => setGroupId(event.target.value)} disabled={setupLoading}><option value="">Select a Contact Group…</option>{(setup?.groups || []).map(group => <option key={group.id} value={group.id}>{group.name}{group.total_contacts ? ` — ${group.total_contacts} contacts` : ""}</option>)}</select></div>
          <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><label className="label">Approved WhatsApp template</label>{numberId && <button className="btn btn-wire" onClick={loadTemplates} disabled={loadingTemplates} style={{ padding: "5px 8px", fontSize: 9 }}>{loadingTemplates ? "Refreshing…" : "Refresh templates"}</button>}</div><select className="input" value={templateId} onChange={event => setTemplateId(event.target.value)} disabled={!numberId || loadingTemplates}><option value="">{numberId ? "Select a template…" : "Select a number first"}</option>{templates.map(template => <option key={template.id} value={template.id} disabled={!template.sendable}>{template.name} · {template.language} · {template.status}{template.sendable ? "" : " — unavailable"}</option>)}</select></div>
          {selectedTemplate && <div style={{ padding: 12, border: "1px solid var(--wire)", background: "rgba(255,255,255,0.02)" }}><div className="mono" style={{ color: "var(--gold2)", fontSize: 10 }}>{selectedTemplate.category} · {selectedTemplate.language} · {selectedTemplate.status}</div><div style={{ color: "var(--mist)", fontSize: 13, marginTop: 7, whiteSpace: "pre-wrap" }}>{selectedTemplate.body_preview || "This template has no text body preview."}</div>{selectedTemplate.unavailable_reason && <div className="mono" style={{ color: "var(--error-text)", fontSize: 10, marginTop: 8 }}>{selectedTemplate.unavailable_reason}</div>}</div>}
          {selectedTemplate?.sendable && selectedTemplate.variables.map(number => <div key={number}><label className="label">Template variable {"{{" + number + "}}" }</label><select className="input" value={mappings[number]?.source || ""} onChange={event => updateMapping(number, event.target.value)}><option value="">Choose a value…</option><option value="contact_name">Contact name</option><option value="contact_phone">Contact phone</option><option value="contact_email">Contact email</option><option value="fixed">Same text for every recipient</option></select>{mappings[number]?.source === "fixed" && <input className="input" style={{ marginTop: 8 }} value={mappings[number]?.value || ""} onChange={event => updateMapping(number, "fixed", event.target.value)} placeholder="Enter fixed text" />}</div>)}
          {notice && <div className="mono" style={{ fontSize: 11, color: notice.ok ? "var(--success-text)" : "var(--error-text)" }}>{notice.text}</div>}
          {!review ? <button className="btn btn-gold" onClick={reviewBroadcast} disabled={sending || !selectedTemplate?.sendable} style={{ alignSelf: "flex-start", padding: "10px 22px" }}>{sending ? "Preparing…" : "Review broadcast"}</button> : <div style={{ padding: 14, border: "1px solid var(--gold)", background: "rgba(184,146,42,0.06)" }}><div style={{ color: "var(--cream)", fontWeight: 600 }}>Review before sending</div><BroadcastReviewSummary review={review} /><div style={{ color: "var(--mist)", fontSize: 12, marginTop: 4 }}>{review.template.name} · {review.template.language}</div>{review.skipped_recipients > 0 && <div className="mono" style={{ color: "var(--error-text)", fontSize: 10, marginTop: 7 }}>Resolve recipient data before sending.</div>}<div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-wire" onClick={() => setReview(null)}>Back</button><button className="btn btn-gold" onClick={send} disabled={sending || review.skipped_recipients > 0 || !review.eligible_recipients}>{sending ? "Sending…" : "Send broadcast"}</button></div></div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--mist)", letterSpacing: 2, textTransform: "uppercase" }}>Broadcast Activity</div>
        <div style={{ display: "flex", gap: 6 }}>{[["all","All"],["scheduled","Scheduled"],["processed","Processed"],["failed","Failed"]].map(([id,label]) => <button key={id} className={activityFilter === id ? "btn btn-gold" : "btn btn-wire"} onClick={() => setActivityFilter(id)} style={{ padding: "5px 8px", fontSize: 9 }}>{label}</button>)}</div>
      </div>
      <div className="card">
        {historyLoading ? <Loader /> : !activity.length ? <Empty msg="No broadcast activity yet" /> : activity.map(broadcast => {
          const status = statusFor(broadcast); if (!status) return null;
          return <div key={broadcast.id} className="row" style={{ gridTemplateColumns: "2fr 2fr 1fr 1fr 90px auto", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)" }}>{broadcast.broadcast_name || "Untitled Broadcast"}</div>
            <div style={{ fontSize: 12, color: "var(--mist)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{broadcast.message}</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{Array.isArray(broadcast.contacts) ? broadcast.contacts.length : 0} recipients</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{new Date(broadcast.completed_at || broadcast.scheduled_at || broadcast.created_at).toLocaleString()}</div>
            <div className={"badge " + status.cls}>{status.label}</div>
            <button className="btn btn-wire" onClick={() => setActivityId(broadcast.id)} aria-expanded={activityId === broadcast.id} aria-controls="broadcast-details">Details</button>
          </div>;
        })}
      </div>
      {activityId && <BroadcastDetails id={activityId} apiBase={API} apiFetch={apiFetch} onClose={() => setActivityId(null)} />}
    </div>
  );
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
function Contacts({ customer, initialTab = "contacts", routeGroupId = null, onRouteOpen, onRouteUnavailable }) {
  const { data, loading, refetch } = useAPI("/contacts");
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupCreateAction, setGroupCreateAction] = useState("empty");
  const [activeGroup, setActiveGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [newTargetGroupName, setNewTargetGroupName] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showGroupAddChoice, setShowGroupAddChoice] = useState(false);
  const [pickerGroup, setPickerGroup] = useState(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerContactIds, setPickerContactIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importGroup, setImportGroup] = useState(null);

  // Contacts and Contact Groups are two views of the same workspace-scoped
  // resource. Keep direct navigation to /contact-groups on the Groups view.
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const notify = (text, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 3000); };
  const groupRequest = async (path = "", init: RequestInit = {}) => {
    const response = await apiFetch(`${API}/contact-groups${path}`, init);
    return response.json();
  };
  const canManageGroups = ["owner", "admin"].includes(customer?.role);
  const filtered = (data || []).filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone_number || "").includes(search));
  const filteredMembers = members.filter(member => `${member.contact?.name || ""} ${member.contact?.phone_number || ""}`.toLowerCase().includes(memberSearch.toLowerCase()));
  const pickerContacts = (data || []).filter(contact => `${contact.name || ""} ${contact.phone_number || ""}`.toLowerCase().includes(pickerSearch.toLowerCase()));

  const toggleSelection = (setter, id) => setter(current => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAll = (setter, rows, idFor = row => row.id) => setter(new Set(rows.map(idFor)));
  const clearSelection = setter => setter(new Set());

  async function loadGroups() {
    if (!customer?.id) return;
    setGroupsLoading(true);
    try {
      setGroups(await groupRequest());
    } catch (error) {
      notify(error.message || "Could not load groups", false);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }
  useEffect(() => { if (tab === "groups") loadGroups(); }, [tab, customer?.id]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (showContactPicker) setShowContactPicker(false);
      else if (showGroupAddChoice) setShowGroupAddChoice(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showContactPicker, showGroupAddChoice]);

  async function createGroup(action = groupCreateAction) {
    const name = groupName.trim();
    if (!name) return;
    try {
      const group = await groupRequest("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setGroupName(""); setShowGroupForm(false); await loadGroups();
      if (action === "select") { await openGroup(group); openContactPicker(group); }
      else if (action === "upload") { await openGroup(group); setImportGroup(group); setShowImport(true); }
      else notify("Contact group created");
    } catch (error) {
      notify(error.message || "Could not create group", false);
    }
  }
  async function openGroup(group, updateRoute = true) {
    setActiveGroup(group); setMemberSearch(""); setSelectedMemberIds(new Set());
    try {
      const result = await groupRequest(`/${group.id}/members`);
      setMembers(result.members || []);
      if (updateRoute) onRouteOpen?.(group.id);
    } catch (error) {
      setActiveGroup(null);
      notify(error.message || "Could not load group members", false);
    }
  }
  useEffect(() => {
    if (!routeGroupId) { setActiveGroup(null); return; }
    if (!customer?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const available = groups.length ? groups : await groupRequest();
        const group = available.find((item) => item.id === routeGroupId);
        if (!group) {
          if (!cancelled) { setActiveGroup(null); onRouteUnavailable?.(); }
          return;
        }
        if (!cancelled) await openGroup(group, false);
      } catch (error) {
        if (!cancelled) { setActiveGroup(null); notify(error.message || "Could not load this contact group", false); onRouteUnavailable?.(); }
      }
    })();
    return () => { cancelled = true; };
  }, [routeGroupId, customer?.id]);
  async function addContactsToGroup(group, contactIds) {
    if (!group || !contactIds.length) return null;
    try {
      const result = await groupRequest(`/${group.id}/members/batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_ids: contactIds }) });
      notify(`${result.added_count || 0} contacts added · ${result.already_member_count || 0} already in group · ${result.failed_count || 0} failed`);
      if (activeGroup?.id === group.id) await openGroup(group);
      await loadGroups();
      return result;
    } catch (error) {
      notify(error.message || "Could not add contacts to this group", false);
      return null;
    }
  }
  async function removeMembers(contactIds) {
    if (!activeGroup || !contactIds.length) return;
    try {
      const result = await groupRequest(`/${activeGroup.id}/members/batch`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_ids: contactIds }) });
      notify(`${result.removed_count || 0} removed · ${result.not_member_count || 0} no longer in group · ${result.failed_count || 0} failed`);
      await openGroup(activeGroup); await loadGroups();
    } catch (error) {
      notify(error.message || "Could not remove contacts from this group", false);
    }
  }
  function openContactPicker(group) {
    if (activeGroup?.id !== group.id) setMembers([]);
    setPickerGroup(group); setPickerSearch(""); setPickerContactIds(new Set()); setShowContactPicker(true);
  }
  function chooseExistingContacts(group) {
    setShowGroupAddChoice(false);
    openContactPicker(group);
  }
  function chooseUploadContacts(group) {
    setShowGroupAddChoice(false);
    // The group detail page remains the background route; no prior modal is
    // left mounted beneath the importer.
    setImportGroup(group);
    setShowImport(true);
  }
  async function applyPickerSelection() {
    const result = await addContactsToGroup(pickerGroup, [...pickerContactIds]);
    if (result) setShowContactPicker(false);
  }
  async function applySelectedToGroup() {
    let group = groups.find(item => item.id === targetGroupId);
    try {
      if (targetGroupId === "__new") {
        const name = newTargetGroupName.trim();
        if (!name) return notify("Enter a new group name", false);
        group = await groupRequest("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      }
      if (!group) return notify("Choose a contact group", false);
      const result = await addContactsToGroup(group, [...selectedContactIds]);
      if (result) { setSelectedContactIds(new Set()); setShowAddToGroup(false); setTargetGroupId(""); setNewTargetGroupName(""); }
    } catch (error) { notify(error.message || "Could not add contacts to a group", false); }
  }
  async function deleteGroup(group) {
    try {
      await groupRequest(`/${group.id}`, { method: "DELETE" });
      if (activeGroup?.id === group.id) setActiveGroup(null);
      notify("Contact group deleted"); loadGroups();
    } catch (error) {
      notify(error.message || "Could not delete group", false);
    }
  }

  if (activeGroup) return <div className="pad" style={{ padding: 28 }}>
    {toast && <div className="mono" style={{ position:"fixed",right:24,bottom:24,zIndex:2000,padding:"12px 16px",background:toast.ok?"#1A3A2A":"#7F1D1D",color:toast.ok?"var(--success-text)":"var(--error-text)",border:"1px solid var(--wire2)",fontSize:11 }}>{toast.text}</div>}
    <button className="btn btn-wire" onClick={() => onRouteUnavailable?.()} style={{ marginBottom:18 }}>← Back to Contact Groups</button>
    <PageHead label="Contact Groups" title={activeGroup.name} sub={`${members.length} contacts${activeGroup.description ? ` · ${activeGroup.description}` : ""}`} action={canManageGroups ? <button className="btn btn-gold" onClick={() => { setPickerGroup(activeGroup); setShowGroupAddChoice(true); }}>Add Contacts</button> : null} />
    <input className="input" placeholder="Search group members..." value={memberSearch} onChange={event=>setMemberSearch(event.target.value)} style={{marginBottom:10}}/>
    {canManageGroups && selectedMemberIds.size > 0 && <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><button className="btn btn-danger" onClick={()=>removeMembers([...selectedMemberIds])}>Remove {selectedMemberIds.size} from Group</button></div>}
    {!members.length?<Empty msg="No contacts in this group yet"/>:<div className="card"><div className="row th" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr":"2fr 1.5fr",gap:12}}>{canManageGroups&&<input aria-label="Select all matching group members" type="checkbox" checked={filteredMembers.length>0&&filteredMembers.every(member=>selectedMemberIds.has(member.contact_id))} onChange={event=>event.target.checked?selectAll(setSelectedMemberIds,filteredMembers,member=>member.contact_id):clearSelection(setSelectedMemberIds)}/>}<div>Name</div><div>Phone</div></div>{filteredMembers.map(member=><div key={member.id} className="row" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr":"2fr 1.5fr",gap:12}}>{canManageGroups&&<input aria-label={`Select ${member.contact.name || member.contact.phone_number}`} type="checkbox" checked={selectedMemberIds.has(member.contact_id)} onChange={()=>toggleSelection(setSelectedMemberIds,member.contact_id)}/>}<div style={{color:"var(--cream)",fontSize:13}}>{member.contact.name||"Unnamed contact"}</div><div style={{color:"var(--mist)",fontSize:12}}>{member.contact.phone_number}</div></div>)}</div>}
    {showGroupAddChoice && pickerGroup && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Add Contacts"><div className="modal" style={{maxWidth:520}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUP</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Add contacts to {pickerGroup.name}.</h3></div><button className="btn btn-wire" aria-label="Close" onClick={()=>setShowGroupAddChoice(false)}>×</button></div><p style={{color:"var(--mist)",fontSize:12,margin:"12px 0 16px"}}>Choose how you would like to add contacts to this group.</p><div style={{display:"grid",gap:8}}><button className="btn btn-gold" onClick={()=>chooseExistingContacts(pickerGroup)}>Select Existing Contacts</button><button className="btn btn-wire" onClick={()=>chooseUploadContacts(pickerGroup)}>Upload Contacts</button></div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-wire" onClick={()=>setShowGroupAddChoice(false)}>Cancel</button></div></div></div>}
    {showContactPicker && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Select existing contacts"><div className="modal" style={{maxWidth:760,maxHeight:"90vh",padding:0,display:"flex",flexDirection:"column",overflow:"hidden"}}><div style={{padding:"18px 20px 12px",borderBottom:"1px solid var(--wire)",flexShrink:0}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUPS</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Add contacts to {pickerGroup?.name}.</h3></div><button className="btn btn-wire" aria-label="Close contact selector" onClick={()=>setShowContactPicker(false)}>×</button></div><input className="input" placeholder="Search contacts..." value={pickerSearch} onChange={event=>setPickerSearch(event.target.value)} style={{margin:"12px 0 0"}}/><div style={{display:"flex",gap:8,marginTop:10}}><button className="btn btn-wire" onClick={()=>selectAll(setPickerContactIds,pickerContacts.filter(contact=>!members.some(member=>member.contact_id===contact.id)))}>Select all matching ({pickerContacts.filter(contact=>!members.some(member=>member.contact_id===contact.id)).length})</button><button className="btn btn-wire" onClick={()=>clearSelection(setPickerContactIds)}>Clear</button></div></div><div style={{overflowY:"auto",padding:"12px 20px",minHeight:0,flex:1}}><div className="card">{pickerContacts.map(contact=>{const already=members.some(member=>member.contact_id===contact.id);return <label key={contact.id} className="row" style={{gridTemplateColumns:"34px 2fr 1.5fr 100px",gap:12,cursor:"pointer"}}><input type="checkbox" disabled={already} checked={pickerContactIds.has(contact.id)} onChange={()=>toggleSelection(setPickerContactIds,contact.id)}/><span style={{color:"var(--cream)",fontSize:13}}>{contact.name||"Unnamed contact"}</span><span style={{color:"var(--mist)",fontSize:12}}>{contact.phone_number}</span><span className={already?"badge badge-cream":"mono"} style={{fontSize:9,color:already?undefined:"var(--mist)"}}>{already?"Already in group":""}</span></label>})}</div></div><div style={{padding:"12px 20px 18px",borderTop:"1px solid var(--wire)",display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}><button className="btn btn-wire" onClick={()=>setShowContactPicker(false)}>Cancel</button><button className="btn btn-gold" disabled={!pickerContactIds.size} onClick={applyPickerSelection}>Add selected ({pickerContactIds.size})</button></div></div></div>}
    <ContactsImport open={showImport} onClose={() => { setShowImport(false); setImportGroup(null); }} fixedGroup={importGroup} apiFetch={apiFetch} apiBase={API} onImported={() => { refetch(); loadGroups(); if (importGroup) openGroup(importGroup, false); }} />
  </div>;

  return <div className="pad" style={{ padding: 28 }}>
    {toast && <div className="mono" style={{ position:"fixed",right:24,bottom:24,zIndex:2000,padding:"12px 16px",background:toast.ok?"#1A3A2A":"#7F1D1D",color:toast.ok?"var(--success-text)":"var(--error-text)",border:"1px solid var(--wire2)",fontSize:11 }}>{toast.text}</div>}
    <PageHead label="Database" title="Contacts." sub={loading ? "Loading..." : `${data?.length || 0} contacts`} action={canManageGroups ? (tab === "groups" ? <button className="btn btn-gold" onClick={() => setShowGroupForm(true)}><Ic n="plus" s={12} c="var(--ink)" />New Contact Group</button> : <button className="btn btn-gold" onClick={() => setShowImport(true)}><Ic n="plus" s={12} c="var(--ink)" />Import Contacts</button>) : null} />
    <div style={{ display:"flex",borderBottom:"1px solid var(--wire)",marginBottom:20 }}>
      {[["contacts","All Contacts"],["groups","Contact Groups"]].map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{background:"none",border:"none",borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent",color:tab===id?"var(--gold2)":"var(--mist)",padding:"10px 18px",fontFamily:"DM Mono, monospace",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{label}</button>)}
    </div>
    {tab === "contacts" && <>
      <div style={{ position:"relative",marginBottom:16 }}><input className="input" placeholder="Search contacts..." value={search} onChange={event => setSearch(event.target.value)} /></div>
      {canManageGroups && selectedContactIds.size > 0 && <div className="card-gold" style={{padding:"12px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><span style={{fontSize:13,color:"var(--cream)"}}>{selectedContactIds.size} contacts selected</span><div style={{display:"flex",gap:8}}><button className="btn btn-gold" onClick={()=>setShowAddToGroup(true)}>Add to Group</button><button className="btn btn-wire" onClick={()=>clearSelection(setSelectedContactIds)}>Clear selection</button></div></div>}
      <div className="card"><div className="row th" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr 1fr 1fr":"2fr 1.5fr 1fr 1fr",gap:12}}>{canManageGroups&&<div><input aria-label="Select all matching contacts" type="checkbox" checked={filtered.length>0&&filtered.every(contact=>selectedContactIds.has(contact.id))} onChange={event=>event.target.checked?selectAll(setSelectedContactIds,filtered):clearSelection(setSelectedContactIds)}/></div>}{["Name","Phone","Tag","Added"].map(h => <div key={h}>{h}</div>)}</div>{loading?<Loader/>:!filtered.length?<Empty msg="No contacts found"/>:filtered.map(contact => <div key={contact.id} className="row" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr 1fr 1fr":"2fr 1.5fr 1fr 1fr",gap:12}}>{canManageGroups&&<input aria-label={`Select ${contact.name || contact.phone_number}`} type="checkbox" checked={selectedContactIds.has(contact.id)} onChange={()=>toggleSelection(setSelectedContactIds,contact.id)}/>}<div style={{color:"var(--cream)",fontSize:13}}>{contact.name}</div><div style={{color:"var(--mist)",fontSize:12}}>{contact.phone_number}</div><div className="badge badge-cream">{contact.tag || "Contact"}</div><div style={{color:"var(--mist)",fontSize:11}}>{contact.created_at ? new Date(contact.created_at).toLocaleDateString() : "—"}</div></div>)}</div>
    </>}
    {tab === "groups" && (groupsLoading?<Loader/>:!groups.length?<Empty msg="No contact groups yet"/>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>{groups.map(group=><div key={group.id} className="card" style={{padding:"18px 20px"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:14}}><div><div style={{fontSize:13,fontWeight:600,color:"var(--cream)"}}>{group.name}</div>{group.description&&<div style={{fontSize:11,color:"var(--mist)"}}>{group.description}</div>}</div><div className="mono" style={{fontSize:10,color:"var(--gold2)"}}>{group.member_count} CONTACTS</div></div><div style={{display:"flex",gap:8}}><button className="btn btn-gold" style={{flex:1,fontSize:9,padding:"7px 10px"}} onClick={()=>openGroup(group)}>{canManageGroups ? "Manage" : "View"}</button>{canManageGroups && <button className="btn btn-danger" style={{fontSize:9,padding:"7px 10px"}} onClick={()=>deleteGroup(group)}>Delete</button>}</div></div>)}</div>)}
    {showGroupForm && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="New Contact Group"><div className="modal" style={{maxWidth:520}}><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>NEW CONTACT GROUP</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Create a group.</h3><label className="label">Group name</label><input className="input" value={groupName} onChange={event=>setGroupName(event.target.value)} placeholder="e.g. Facebook Leads"/><p style={{fontSize:12,color:"var(--mist)",margin:"14px 0 8px"}}>What would you like to do next?</p><div style={{display:"grid",gap:8}}>{[["select","Select Existing Contacts","Search and select contacts in this workspace."],["upload","Upload Contacts","Import a file using the existing secure import flow."],["empty","Create Empty Group","Create the group without contacts for now."]].map(([id,label,copy])=><button key={id} className={groupCreateAction===id?"btn btn-gold":"btn btn-wire"} style={{textAlign:"left",padding:12}} onClick={()=>setGroupCreateAction(id)}><strong>{label}</strong><span style={{display:"block",fontSize:11,opacity:.75,marginTop:3}}>{copy}</span></button>)}</div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button className="btn btn-wire" onClick={()=>setShowGroupForm(false)}>Cancel</button><button className="btn btn-gold" onClick={()=>createGroup()} disabled={!groupName.trim()}>{groupCreateAction === "upload" ? "Create & Continue" : groupCreateAction === "select" ? "Create & Select Contacts" : "Create group"}</button></div></div></div>}
    {showAddToGroup && <div className="modal-bg" role="dialog" aria-modal="true"><div className="modal" style={{maxWidth:520}}><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUPS</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Add {selectedContactIds.size} contacts to group.</h3><label className="label">Group</label><select className="input" value={targetGroupId} onChange={event=>setTargetGroupId(event.target.value)}><option value="">Choose a group…</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}<option value="__new">Create a new group</option></select>{targetGroupId==="__new"&&<><label className="label" style={{marginTop:12}}>New group name</label><input className="input" value={newTargetGroupName} onChange={event=>setNewTargetGroupName(event.target.value)} placeholder="e.g. Facebook Leads"/></>}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button className="btn btn-wire" onClick={()=>setShowAddToGroup(false)}>Cancel</button><button className="btn btn-gold" onClick={applySelectedToGroup}>Add contacts</button></div></div></div>}
    {showGroupAddChoice && pickerGroup && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Add Contacts"><div className="modal" style={{maxWidth:520}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUP</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Add contacts to {pickerGroup.name}.</h3></div><button className="btn btn-wire" aria-label="Close" onClick={()=>setShowGroupAddChoice(false)}>×</button></div><p style={{color:"var(--mist)",fontSize:12,margin:"12px 0 16px"}}>Choose how you would like to add contacts to this group.</p><div style={{display:"grid",gap:8}}><button className="btn btn-gold" onClick={()=>chooseExistingContacts(pickerGroup)}>Select Existing Contacts</button><button className="btn btn-wire" onClick={()=>chooseUploadContacts(pickerGroup)}>Upload Contacts</button></div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-wire" onClick={()=>setShowGroupAddChoice(false)}>Cancel</button></div></div></div>}
    {showContactPicker && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Select existing contacts"><div className="modal" style={{maxWidth:760,maxHeight:"90vh",padding:0,display:"flex",flexDirection:"column",overflow:"hidden"}}><div style={{padding:"18px 20px 12px",borderBottom:"1px solid var(--wire)",flexShrink:0}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUPS</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>Add contacts to {pickerGroup?.name}.</h3></div><button className="btn btn-wire" aria-label="Close contact selector" onClick={()=>setShowContactPicker(false)}>×</button></div><input className="input" placeholder="Search contacts..." value={pickerSearch} onChange={event=>setPickerSearch(event.target.value)} style={{margin:"12px 0 0"}}/><div style={{display:"flex",gap:8,marginTop:10}}><button className="btn btn-wire" onClick={()=>selectAll(setPickerContactIds,pickerContacts.filter(contact=>!members.some(member=>member.contact_id===contact.id)))}>Select all matching ({pickerContacts.filter(contact=>!members.some(member=>member.contact_id===contact.id)).length})</button><button className="btn btn-wire" onClick={()=>clearSelection(setPickerContactIds)}>Clear</button></div></div><div style={{overflowY:"auto",padding:"12px 20px",minHeight:0,flex:1}}><div className="card">{pickerContacts.map(contact=>{const already=members.some(member=>member.contact_id===contact.id);return <label key={contact.id} className="row" style={{gridTemplateColumns:"34px 2fr 1.5fr 100px",gap:12,cursor:"pointer"}}><input type="checkbox" disabled={already} checked={pickerContactIds.has(contact.id)} onChange={()=>toggleSelection(setPickerContactIds,contact.id)}/><span style={{color:"var(--cream)",fontSize:13}}>{contact.name||"Unnamed contact"}</span><span style={{color:"var(--mist)",fontSize:12}}>{contact.phone_number}</span><span className={already?"badge badge-cream":"mono"} style={{fontSize:9,color:already?undefined:"var(--mist)"}}>{already?"Already in group":""}</span></label>})}</div></div><div style={{padding:"12px 20px 18px",borderTop:"1px solid var(--wire)",display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}><button className="btn btn-wire" onClick={()=>setShowContactPicker(false)}>Cancel</button><button className="btn btn-gold" disabled={!pickerContactIds.size} onClick={applyPickerSelection}>Add selected ({pickerContactIds.size})</button></div></div></div>}
    {activeGroup && <div className="modal-bg" role="dialog" aria-modal="true"><div className="modal" style={{maxWidth:760,maxHeight:"90vh",overflowY:"auto"}}><div className="mono" style={{fontSize:9,color:"var(--gold2)",letterSpacing:2}}>CONTACT GROUP</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24}}>{activeGroup.name}</h3><div style={{color:"var(--mist)",fontSize:12,marginTop:4}}>{activeGroup.name} — {members.length} contacts</div>{canManageGroups&&<div style={{display:"flex",justifyContent:"space-between",gap:8,margin:"16px 0",flexWrap:"wrap"}}><button className="btn btn-gold" onClick={()=>{setPickerGroup(activeGroup);setShowGroupAddChoice(true)}}>Add Contacts</button>{selectedMemberIds.size>0&&<button className="btn btn-danger" onClick={()=>removeMembers([...selectedMemberIds])}>Remove {selectedMemberIds.size} from Group</button>}</div>}<input className="input" placeholder="Search group members..." value={memberSearch} onChange={event=>setMemberSearch(event.target.value)} style={{marginBottom:10}}/>{!members.length?<Empty msg="No contacts in this group yet"/>:<div className="card"><div className="row th" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr":"2fr 1.5fr",gap:12}}>{canManageGroups&&<input aria-label="Select all matching group members" type="checkbox" checked={filteredMembers.length>0&&filteredMembers.every(member=>selectedMemberIds.has(member.contact_id))} onChange={event=>event.target.checked?selectAll(setSelectedMemberIds,filteredMembers,member=>member.contact_id):clearSelection(setSelectedMemberIds)}/>}<div>Name</div><div>Phone</div></div>{filteredMembers.map(member=><div key={member.id} className="row" style={{gridTemplateColumns:canManageGroups?"34px 2fr 1.5fr":"2fr 1.5fr",gap:12}}>{canManageGroups&&<input aria-label={`Select ${member.contact.name || member.contact.phone_number}`} type="checkbox" checked={selectedMemberIds.has(member.contact_id)} onChange={()=>toggleSelection(setSelectedMemberIds,member.contact_id)}/>}<div style={{color:"var(--cream)",fontSize:13}}>{member.contact.name||"Unnamed contact"}</div><div style={{color:"var(--mist)",fontSize:12}}>{member.contact.phone_number}</div></div>)}</div>}<div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-wire" onClick={()=>setActiveGroup(null)}>Done</button></div></div></div>}    <ContactsImport open={showImport} onClose={() => { setShowImport(false); setImportGroup(null); }} fixedGroup={importGroup} apiFetch={apiFetch} apiBase={API} onImported={() => { refetch(); loadGroups(); if (importGroup) openGroup(importGroup); }} />

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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 9, alignItems: "center", flexWrap: "wrap" }}>
              <ConversationHandlingStatus conversation={conversation} />
              <MarketingOptOutBadge contact={conversation.contacts} />
              <span className="mono" style={{ color: "var(--mist)", fontSize: 9 }}>{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : "—"}</span>
            </div>
          </button>)}
      </div>

      <div className="card" style={{ minHeight: 540, display: "flex", flexDirection: "column" }}>
        {!selectedId ? <Empty msg="Select a conversation to view messages" /> : threadLoading ? <Loader /> : threadError ? <div role="alert" style={{ padding: 18, color: "var(--error-text)", fontSize: 12 }}>{threadError}</div> : !active ? <Empty msg="Conversation unavailable" /> : <>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--wire)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div><div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 600 }}>{active.contacts?.name || active.contacts?.phone_number || "Customer"}</div><div style={{ color: "var(--mist)", fontSize: 11, marginTop: 3 }}>{active.contacts?.phone_number || "No phone number"}</div></div>
            <ConversationHandlingStatus conversation={active} />
            <MarketingOptOutBadge contact={active.contacts} />
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
              <span style={{ color: "var(--mist)", fontSize: 10 }}>{isHuman ? "Zoe is not responding. Replies are sent through this workspace’s WhatsApp number." : active?.control_mode === "needs_attention" ? "Zoe has stopped responding. A team member needs to respond." : "Take or reopen this conversation before replying."}</span>
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
          <div style={{ marginTop: 10 }}><MarketingOptOutBadge contact={active.contacts} /></div>
          {active.contacts?.marketing_opted_out === true && <p style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.5 }}>Excluded from marketing broadcasts. Customer-service conversations and service automation remain available.</p>}
          {active.contacts?.tag && <div className="badge badge-cream" style={{ marginTop: 10 }}>{active.contacts.tag}</div>}
          <div style={{ borderTop: "1px solid var(--wire)", margin: "18px 0", paddingTop: 16 }}>
            <div className="label">Conversation status</div>
            <ConversationHandlingStatus conversation={active} />
            {active.control_mode === "needs_attention" && <div style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>Zoe has stopped responding. A team member needs to respond.</div>}
            {active.control_mode === "human" && active.status !== "resolved" && <div style={{ color: "var(--mist)", fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>Zoe is not responding while a team member handles this chat.</div>}
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
  const workspaceKey = customer?.id || "";
  const { data: automationData, loading, error, refetch } = useAPI("/automations", [workspaceKey]);
  const { data: libraryData, loading: libraryLoading, error: libraryError, refetch: refetchLibrary } = useAPI("/automations/library", [workspaceKey]);
  const { data: contentData, loading: contentLoading } = useAPI("/content", [workspaceKey]);
  const { data: historyData, loading: historyLoading, error: historyError, refetch: refetchHistory } = useAPI("/automations/history", [workspaceKey]);
  const { data: settingsData, refetch: refetchSettings } = useAPI("/automations/settings", [workspaceKey]);
  const canManage = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());
  const [preview, setPreview] = useState(null);
  const [composer, setComposer] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sourceMode, setSourceMode] = useState("message");
  const [contentId, setContentId] = useState("");
  const [form, setForm] = useState({ phrases: "", response: "", priority: 100, topic: "" });
  const [timezone, setTimezone] = useState("Africa/Lusaka");
  const [hours, setHours] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [reviewing, setReviewing] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const days = [["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],["fri","Friday"],["sat","Saturday"],["sun","Sunday"]];
  const icons = { welcome:"👋", away:"🌙", keyword:"🔑", faq:"❓", human_handoff:"🙋" };
  const titles = { welcome:"Welcome Message", away:"Away Message", keyword:"Keyword Response", faq:"FAQ Response", human_handoff:"Human Handoff" };
  const automations = Array.isArray(automationData) ? automationData : [];
  const templates = Array.isArray(libraryData?.templates) ? libraryData.templates : [];
  const recommended = Array.isArray(libraryData?.recommendations) ? libraryData.recommendations : [];
  const available = templates.filter((item) => item.availability === "available");
  const comingSoon = templates.filter((item) => item.availability === "coming_soon");
  const contentItems = (contentData?.items || contentData || []).filter((item) => !item.archived_at && ["TEXT","LINK"].includes(String(item.content_type || "").toUpperCase()));
  const parsePhrases = (value) => [...new Set(String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean))];
  const isLegacyDefault = (item) => !item?.automation_type && String(item?.trigger_value || "").toUpperCase() === "DEFAULT";
  const nameFor = (item) => titles[item?.automation_type] || (isLegacyDefault(item) ? "Default reply" : item?.trigger_value ? "Keyword: " + item.trigger_value : "Automation");
  const summaryFor = (item) => item?.automation_type === "human_handoff" ? "Pauses automation and sends the conversation to your team." : item?.automation_type === "welcome" ? "Welcomes each customer once on this business number." : item?.automation_type === "away" ? "Replies outside your configured business hours." : item?.content_library_item_id ? "Replies with a selected Content Library item." : String(item?.message_template || "Configured automation response.").slice(0, 110);
  const normalHours = (value) => days.reduce((all, [key]) => ({ ...all, [key]: Array.isArray(value?.[key]) ? value[key] : [] }), {});
  const firstInterval = (key) => hours[key]?.[0] || { start:"08:00", end:"17:00" };
  const changeHours = (key, field, value) => setHours((current) => ({ ...current, [key]: [{ ...firstInterval(key), [field]: value }] }));
  const closeDay = (key, open) => setHours((current) => ({ ...current, [key]: open ? [{ start:"08:00", end:"17:00" }] : [] }));
  const reset = () => { setPreview(null); setComposer(null); setEditing(null); setSourceMode("message"); setContentId(""); setForm({ phrases:"", response:"", priority:100, topic:"" }); setNotice(""); setConflicts([]); setReviewing(false); };
  const configured = (template) => automations.find((item) => item.is_active && item.automation_type === template.automation_type && ["single"].includes(template.duplicate_strategy));
  const openPreview = (template) => { setPreview(template); setNotice(""); };
  const openComposer = (template, item = null) => {
    if (!canManage || !template || template.availability !== "available") return;
    const config = item?.trigger_config || {};
    setPreview(null); setComposer(template); setEditing(item);
    setSourceMode(item?.content_library_item_id ? "content" : "message"); setContentId(item?.content_library_item_id || "");
    setForm({ phrases:(config.phrases || template.suggested_phrases || (item?.trigger_value ? [item.trigger_value] : [])).join("\n"), response:item?.message_template || template.suggested_response || "", priority:item?.priority ?? 100, topic:config.topic || "" });
    setTimezone(settingsData?.timezone || "Africa/Lusaka"); setHours(normalHours(settingsData?.business_hours)); setNotice(""); setConflicts([]); setReviewing(false);
  };
  const submitReview = async () => {
    const list = parsePhrases(form.phrases);
    if (["keyword","faq","human_handoff"].includes(composer.automation_type) && !list.length) return setNotice("Add at least one phrase a customer might use.");
    if (composer.automation_type !== "human_handoff" && sourceMode === "message" && !form.response.trim()) return setNotice("Write the response customers should receive.");
    if (composer.automation_type !== "human_handoff" && sourceMode === "content" && !contentId) return setNotice("Choose a Text or Link item from Content Library.");
    setSaving(true); setNotice("");
    try {
      const result = await apiFetch(API + "/automations/library/preflight", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ library_template_id:composer.id, library_template_version:composer.version, automation_type:composer.automation_type, phrases:list, exclude_id:editing?.id || null }) });
      const preflight = await result.json();
      setConflicts(preflight?.conflicts || []); setReviewing(true);
    } catch (failure) { setNotice(failure?.message || "We could not check this automation."); } finally { setSaving(false); }
  };
  const activate = async () => {
    if (conflicts.length) return setNotice("Resolve the listed conflict before activating this automation.");
    const list = parsePhrases(form.phrases);
    setSaving(true); setNotice("");
    try {
      if (composer.automation_type === "away") await apiFetch(API + "/automations/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ timezone, business_hours:normalHours(hours) }) });
      const payload = {
        automation_type:composer.automation_type, trigger_type:"keyword", trigger_value:list[0] || composer.automation_type.toUpperCase(),
        trigger_config:["keyword","faq","human_handoff"].includes(composer.automation_type) ? { phrases:list, ...(composer.automation_type === "faq" && form.topic.trim() ? { topic:form.topic.trim() } : {}) } : {},
        condition_config:{}, action_config:{ kind:composer.automation_type === "human_handoff" ? "human_handoff" : sourceMode === "content" ? "content_library" : "send_text" },
        message_template:composer.automation_type === "human_handoff" || sourceMode === "content" ? "" : form.response,
        content_library_item_id:sourceMode === "content" ? contentId : null, priority:Number(form.priority),
        library_template_id:composer.id, library_template_version:composer.version
      };
      await apiFetch(API + "/automations" + (editing ? "/" + editing.id : ""), { method:editing ? "PATCH" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      await Promise.all([refetch(), refetchSettings()]); reset();
    } catch (failure) { setNotice(failure?.message || "We could not activate this automation."); } finally { setSaving(false); }
  };
  const toggle = async (item) => { try { await apiFetch(API + "/automations/" + item.id, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({is_active:!item.is_active}) }); refetch(); } catch (failure) { setNotice(failure?.message || "We could not update this automation."); } };
  const categories = ["All","Customer Service","Sales & Leads","Bookings","Operations","Engagement","Industry Templates"];
  const filtered = available.filter((item) => (category === "All" || item.category === category) && (!search.trim() || [item.title,item.description,item.category,...item.industries,...item.goals].join(" ").toLowerCase().includes(search.toLowerCase())));
  const eventLabel = (event) => String(event?.outcome || event?.event_type || "").toLowerCase().includes("handoff") ? "Handed to team" : String(event?.outcome || "").toLowerCase().includes("error") ? "Error" : String(event?.outcome || "").toLowerCase().includes("skip") ? "Skipped" : "Triggered";
  const when = (date) => date ? new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(date)) : "";
  const reviewResponse = () => sourceMode === "content" ? (contentItems.find((item) => item.id === contentId)?.name || "Selected Content Library item") : form.response.trim();
  const reviewHours = () => days.map(([key, label]) => {
    const intervals = hours[key] || [];
    return label + " · " + (intervals.length ? intervals.map((interval) => interval.start + "–" + interval.end).join(", ") : "Closed");
  });
  const reviewTrigger = () => {
    if (composer?.automation_type === "welcome") return "When a customer contacts this business number for the first time.";
    if (composer?.automation_type === "away") return "When a customer messages outside these business hours.";
    if (composer?.automation_type === "human_handoff") return "When a customer uses: " + (parsePhrases(form.phrases).join(", ") || "your chosen phrases") + ".";
    return "When a customer uses: " + (parsePhrases(form.phrases).join(", ") || "your chosen phrases") + ".";
  };
  const libraryCard = (template, recommendedCard = false) => { const existing = configured(template); return <article key={template.id} className="card" style={{ padding:16, minWidth:recommendedCard ? 260 : 0, display:"flex", flexDirection:"column", gap:10 }}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span className="badge badge-blue">{template.category}</span>{existing && <span className="badge badge-green">Already active</span>}</div><div style={{fontWeight:650,fontSize:15}}>{template.title}</div><div style={{fontSize:12,color:"var(--mist)",lineHeight:1.5,flex:1}}>{template.description}</div>{recommendedCard && <div style={{fontSize:11,color:"var(--gold2)"}}>{template.recommendation_reason}</div>}<button className="btn btn-wire" onClick={() => existing && canManage ? openComposer(template, existing) : openPreview(template)}>{existing && canManage ? "View / Edit" : "Preview"}</button></article> };
  return <div className="pad" style={{padding:28,maxWidth:1240,margin:"0 auto"}}><PageHead label="Customer conversations" title="Automations" sub="Choose a ready-made response, make it yours, and keep your team in control." />
    {!canManage && <div className="card" style={{padding:16,marginBottom:20,borderColor:"var(--wire2)"}}><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.2}}>VIEW ONLY</div><div style={{color:"var(--cream2)",fontSize:13,marginTop:6}}>You can browse the Automation Library and view activity. An owner or admin manages this workspace's automations.</div></div>}
    <section style={{marginBottom:30}}><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.6,textTransform:"uppercase"}}>Recommended for you</div><div style={{color:"var(--cream2)",fontSize:13,margin:"5px 0 14px"}}>Suggestions use your business industry and setup goals. Only working automations appear here.</div>{libraryLoading ? <Loader/> : <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:4}}>{recommended.map((template)=>libraryCard(template,true))}</div>}</section>
    <section className="card" style={{padding:20,marginBottom:22}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><div style={{fontSize:17,fontWeight:650}}>Browse Automation Library</div><div style={{color:"var(--mist)",fontSize:12,marginTop:4}}>Every listed setup uses automation capabilities available today.</div></div><button className="btn btn-wire" onClick={refetchLibrary} disabled={libraryLoading}>Refresh</button></div><input className="input" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search automations" style={{margin:"18px 0 10px",maxWidth:420}}/><div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6}}>{categories.map((item)=><button key={item} className={"btn "+(category===item?"btn-gold":"btn-wire")} onClick={()=>setCategory(item)} style={{whiteSpace:"nowrap",padding:"7px 10px"}}>{item}</button>)}</div>{libraryError ? <div role="alert" style={{color:"var(--error-text)",marginTop:14}}>We could not load the Automation Library.</div> : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginTop:18}}>{filtered.map((template)=>libraryCard(template))}</div>}<div style={{marginTop:20,borderTop:"1px solid var(--wire)",paddingTop:16}}><div className="mono" style={{fontSize:10,color:"var(--mist)",letterSpacing:1.2}}>COMING SOON</div><div style={{fontSize:12,color:"var(--mist)",margin:"6px 0 10px"}}>These need workflow capabilities ZedPing does not offer yet.</div><div style={{display:"flex",gap:8,overflowX:"auto"}}>{comingSoon.map((item)=><span className="badge badge-cream" key={item.id} style={{whiteSpace:"nowrap"}}>{item.title}</span>)}</div></div></section>
    <section className="card" style={{marginBottom:22}}><div style={{padding:"18px 20px",borderBottom:"1px solid var(--wire)",display:"flex",justifyContent:"space-between",gap:12}}><div><div style={{fontSize:16,fontWeight:600}}>Your Automations</div><div style={{fontSize:12,color:"var(--mist)",marginTop:4}}>Workspace-scoped rules, including existing rules created before the Library.</div></div><button className="btn btn-wire" onClick={refetch} disabled={loading}>Refresh</button></div>{notice && <div role="alert" style={{margin:"14px 20px 0",color:"var(--error-text)",fontSize:12}}>{notice}</div>}{loading?<Loader/>:error?<div role="alert" style={{padding:24,color:"var(--error-text)"}}>We could not load automations.</div>:!automations.length?<Empty msg="Preview an Automation Library recipe to get started."/>:<div>{automations.map((item)=><div key={item.id} className="row" style={{gridTemplateColumns:"1.25fr 2.3fr 90px 116px",gap:12}}><div><div style={{fontWeight:600}}>{nameFor(item)}</div><div style={{fontSize:11,color:"var(--mist)",marginTop:4}}>{item.library_template_id ? "Library recipe" : "Existing rule"}</div></div><div style={{fontSize:12,color:"var(--cream2)"}}>{summaryFor(item)}</div><div><span className={"badge "+(item.is_active?"badge-green":"badge-cream")}>{item.is_active?"Active":"Paused"}</span></div><div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{canManage && <><button className="btn btn-wire" onClick={()=> { const template=templates.find((value)=>value.id===item.library_template_id) || {id:"existing",version:1,automation_type:item.automation_type || "keyword",title:nameFor(item),availability:"available",suggested_phrases:[],suggested_response:"",content_library_supported:true,setup_fields:[],duplicate_strategy:"none"}; openComposer(template,item) }} style={{padding:"6px 9px",fontSize:8}}>Edit</button><button className="btn btn-wire" onClick={()=>toggle(item)} style={{padding:"6px 9px",fontSize:8}}>{item.is_active?"Pause":"Activate"}</button></>}</div></div>)}</div>}</section>
    <section className="card"><button type="button" onClick={()=>setShowHistory(value=>!value)} style={{width:"100%",background:"transparent",color:"inherit",border:0,padding:"18px 20px",cursor:"pointer",display:"flex",justifyContent:"space-between",textAlign:"left"}}><div><div style={{fontSize:16,fontWeight:600}}>Activity</div><div style={{fontSize:12,color:"var(--mist)",marginTop:4}}>Recent automation activity is kept for 90 days.</div></div><span className="mono" style={{color:"var(--gold2)",fontSize:10}}>{showHistory?"Hide":"View activity"}</span></button>{showHistory&&<div style={{borderTop:"1px solid var(--wire)"}}><div style={{padding:"12px 20px",display:"flex",justifyContent:"flex-end"}}><button className="btn btn-wire" onClick={refetchHistory} disabled={historyLoading}>Refresh</button></div>{historyLoading?<Loader/>:historyError?<div role="alert" style={{padding:20,color:"var(--error-text)"}}>We could not load activity.</div>:!(historyData||[]).length?<Empty msg="Activity will appear once an automation handles a conversation."/>:(historyData||[]).map((event)=><div key={event.id} className="row" style={{gridTemplateColumns:"120px 1fr 180px",gap:12}}><div><span className="badge badge-blue">{eventLabel(event)}</span></div><div style={{fontSize:12,color:"var(--cream2)"}}>Automation activity recorded.</div><div className="mono" style={{fontSize:10,color:"var(--mist)",textAlign:"right"}}>{when(event.created_at)}</div></div>)}</div>}</section>
    {preview&&<div className="modal-bg" role="dialog" aria-modal="true" aria-label="Automation preview"><div className="modal" style={{maxWidth:620,maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.3}}>AUTOMATION LIBRARY</div><h2 className="editorial" style={{fontSize:32,marginTop:8}}>{preview.title}</h2></div><button className="btn btn-wire" onClick={reset}>Close</button></div><p style={{color:"var(--cream2)",lineHeight:1.55}}>{preview.description}</p><div className="card" style={{padding:14,margin:"14px 0"}}><div className="label">What it handles</div><div style={{fontSize:13}}>{preview.required_capability}</div>{preview.suggested_phrases?.length>0&&<><div className="label" style={{marginTop:14}}>It listens for</div><div style={{fontSize:12,color:"var(--cream2)"}}>{preview.suggested_phrases.join(", ")}</div></>}{preview.suggested_response&&<><div className="label" style={{marginTop:14}}>Suggested response</div><div style={{fontSize:12,color:"var(--cream2)",lineHeight:1.5}}>{preview.suggested_response}</div></>}<div style={{fontSize:11,color:"var(--mist)",marginTop:14}}>Content Library: {preview.content_library_supported ? "You may choose an active Text or Link item." : "Not used by this automation."}</div></div><div style={{fontSize:12,color:"var(--mist)",lineHeight:1.5}}>{preview.limitations}</div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:22}}><button className="btn btn-wire" onClick={reset}>Close</button>{canManage&&<button className="btn btn-gold" onClick={()=>openComposer(preview)}>Use template</button>}</div></div></div>}
    {composer&&<div className="modal-bg" role="dialog" aria-modal="true" aria-label="Configure automation"><div className="modal" style={{maxWidth:680,maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"start"}}><div><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.3}}>{reviewing?"REVIEW":"CUSTOMIZE"}</div><h2 className="editorial" style={{fontSize:31,marginTop:8}}>{icons[composer.automation_type]} {composer.title}</h2></div><button className="btn btn-wire" onClick={reset}>Close</button></div>{reviewing?<><div style={{color:"var(--cream2)",lineHeight:1.55,marginBottom:14}}>Review the customer-facing behaviour before activation.</div><div className="card" style={{padding:16,color:"var(--cream2)"}}>{composer.automation_type!=="human_handoff"&&<div><div className="label">Response</div><div style={{fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{reviewResponse() || "No customer message is sent."}</div></div>}{composer.automation_type==="away"&&<><div className="label" style={{marginTop:18}}>Business hours</div><div style={{display:"grid",gap:5,fontSize:12,lineHeight:1.45}}>{reviewHours().map((line)=><div key={line}>{line}</div>)}</div><div className="label" style={{marginTop:18}}>Timezone</div><div style={{fontSize:13}}>{timezone}</div></>}<div className="label" style={{marginTop:18}}>When this runs</div><div style={{fontSize:13,lineHeight:1.55}}>{reviewTrigger()}</div>{composer.automation_type==="human_handoff"&&<div style={{fontSize:12,color:"var(--mist)",marginTop:12}}>This sends the conversation to your Team Inbox and pauses automation until a team member handles it.</div>}</div>{conflicts.length>0?<div role="alert" className="card" style={{padding:14,marginTop:14,borderColor:"var(--error-text)",color:"var(--error-text)"}}><b>Resolve this conflict first.</b>{conflicts.map((conflict)=><div key={conflict.id} style={{marginTop:6}}>An active workspace automation already uses {conflict.phrase ? "the phrase “"+conflict.phrase+"”" : "this single-use setup"}.</div>)}</div>:<div className="card" style={{padding:14,marginTop:14,color:"var(--cream2)"}}>No active workspace rule conflicts with this setup.</div>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button className="btn btn-wire" onClick={()=>setReviewing(false)}>Back</button><button className="btn btn-gold" disabled={saving||conflicts.length>0} onClick={activate}>{saving?"Activating…":"Activate automation"}</button></div></>:<><p style={{color:"var(--cream2)",fontSize:13,lineHeight:1.5}}>{composer.limitations}</p>{["keyword","faq","human_handoff"].includes(composer.automation_type)&&<div><label className="label">{composer.automation_type==="faq"?"Question or topic":"When a customer says"}</label>{composer.automation_type==="faq"&&<input className="input" value={form.topic} onChange={(event)=>setForm(current=>({...current,topic:event.target.value}))} placeholder="e.g. Business hours" style={{marginBottom:10}}/>}<textarea className="textarea" value={form.phrases} onChange={(event)=>setForm(current=>({...current,phrases:event.target.value}))} placeholder="One exact phrase per line" /><div style={{fontSize:11,color:"var(--mist)",marginTop:6}}>Use exact phrases, one per line. Up to 10 phrases.</div></div>}{composer.automation_type!=="human_handoff"&&<div style={{marginTop:18}}><label className="label">Respond with</label><div style={{display:"flex",gap:8,marginBottom:12}}><button className={"btn "+(sourceMode==="message"?"btn-gold":"btn-wire")} onClick={()=>setSourceMode("message")}>Write a message</button>{composer.content_library_supported&&<button className={"btn "+(sourceMode==="content"?"btn-gold":"btn-wire")} onClick={()=>setSourceMode("content")}>Content Library</button>}</div>{sourceMode==="message"?<textarea className="textarea" maxLength={4096} value={form.response} onChange={(event)=>setForm(current=>({...current,response:event.target.value}))}/>:<div>{contentLoading?<Loader/>:<select className="input" value={contentId} onChange={(event)=>setContentId(event.target.value)}><option value="">Choose Text or Link content</option>{contentItems.map((item)=><option key={item.id} value={item.id}>{item.name} · {String(item.content_type).toLowerCase()}</option>)}</select>}<div style={{fontSize:11,color:"var(--mist)",marginTop:7}}>Only active Text and Link content is supported.</div></div>}</div>}{composer.automation_type==="away"&&<div style={{marginTop:18,borderTop:"1px solid var(--wire)",paddingTop:16}}><label className="label">Workspace timezone</label><input className="input" value={timezone} onChange={(event)=>setTimezone(event.target.value)} placeholder="Africa/Lusaka"/><div style={{fontSize:11,color:"var(--mist)",marginTop:7}}>Use an IANA timezone. An end time earlier than its start means the business is open overnight.</div><div style={{marginTop:16,fontWeight:600}}>Business hours</div>{days.map(([key,label])=>{const interval=firstInterval(key), open=(hours[key]||[]).length>0;return <div key={key} style={{display:"grid",gridTemplateColumns:"104px 70px 1fr 1fr",gap:8,alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--wire)"}}><div style={{fontSize:13}}>{label}</div><label style={{fontSize:11,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={open} onChange={(event)=>closeDay(key,event.target.checked)}/> Open</label><input className="input" type="time" disabled={!open} value={interval.start} onChange={(event)=>changeHours(key,"start",event.target.value)}/><input className="input" type="time" disabled={!open} value={interval.end} onChange={(event)=>changeHours(key,"end",event.target.value)}/></div>})}</div>}{notice&&<div role="alert" style={{color:"var(--error-text)",fontSize:12,marginTop:14}}>{notice}</div>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button className="btn btn-wire" onClick={reset}>Cancel</button><button className="btn btn-gold" disabled={saving} onClick={submitReview}>{saving?"Checking…":"Review"}</button></div></>}</div></div>}
  </div>;
}

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
function ContentLibrary({ customer, routeContentId = null, onRouteOpen, onRouteUnavailable }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState("active");
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
  const [editingContent, setEditingContent] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", text_content: "", link_url: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState("");
  const editFormRef = useRef(editForm);
  const editRevisionRef = useRef(0);
  const editRequestRef = useRef(0);
  const editInFlightRef = useRef(false);
  const editAutosaveTimerRef = useRef(null);
  const contentAutosaveFlushRef = useRef(() => {});
  const [creatingTextDraft, setCreatingTextDraft] = useState(null);
  const [newTextSaving, setNewTextSaving] = useState(false);
  const [newTextNotice, setNewTextNotice] = useState("");
  const newTextRequestRef = useRef(0);
  const newTextInFlightRef = useRef(false);
  const newTextAutosaveTimerRef = useRef(null);
  const [imageKnowledge, setImageKnowledge] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [reviewingKnowledge, setReviewingKnowledge] = useState(null);
  const [knowledgeForm, setKnowledgeForm] = useState({ extracted_text: "", review_notes: "", valid_from: "", valid_until: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingContent, setDeletingContent] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const canManage = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());
  const newTextDirty = type === "TEXT" && (!creatingTextDraft || ["name", "description", "text_content"].some((key) => String(form[key] || "") !== String(creatingTextDraft[key] || "")));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const suffix = lifecycleFilter === "all" ? "?archived=all" : lifecycleFilter === "archived" ? "?archived=true" : "";
      const response = await apiFetch(`${API}/content${suffix}`);
      const result = await response.json();
      setItems(result.items || []);
    } catch (loadError) {
      setError(loadError?.message || "We could not load your Content Library.");
    } finally { setLoading(false); }
  }, [lifecycleFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!routeContentId || loading) return;
    const item = items.find((entry) => String(entry.id) === String(routeContentId));
    if (!item) { onRouteUnavailable?.(); return; }
    setSelected(item);
  }, [routeContentId, items, loading]);

  const begin = async (nextType) => {
    setType(nextType); setActionError(""); setFile(null);
    setForm({ name: "", description: "", text_content: "", link_url: "", template_id: "" });
    setCreatingTextDraft(null); setNewTextNotice("");
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
    if (type === "TEXT") {
      const saved = await persistNewText(form);
      if (saved) { setSelected(saved); onRouteOpen?.(saved.id); setCreating(false); setType(null); setCreatingTextDraft(null); setNewTextNotice(""); }
      return;
    }
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
      setSelected(result.item); onRouteOpen?.(result.item.id); setCreating(false); setType(null);
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

  const beginEdit = (item) => {
    if (!canManage || !["TEXT", "LINK"].includes(item.content_type)) return;
    setEditNotice("");
    setEditForm({ name: item.name || "", description: item.description || "", text_content: item.text_content || "", link_url: item.link_url || "" });
    setEditingContent(item);
  };
  useEffect(() => { editFormRef.current = editForm; }, [editForm]);
  const editDirty = editingContent && ["name", "description", "text_content", "link_url"].some((key) => String(editForm[key] || "") !== String(editingContent[key] || ""));
  const closeEdit = () => {
    if (editSaving) return;
    if (editDirty && !window.confirm("Discard unsaved changes?")) return;
    setEditingContent(null); setEditNotice("");
  };
  const hasUnsavedTextChanges = !!editDirty || (creating && type === "TEXT" && !!newTextDirty);
  useEffect(() => {
    if (!hasUnsavedTextChanges) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedTextChanges]);
  const persistExistingText = useCallback(async (snapshot = editForm, revision = editRevisionRef.current) => {
    if (!editingContent || !canManage || editingContent.content_type !== "TEXT" || editInFlightRef.current) return null;
    editInFlightRef.current = true;
    const request = ++editRequestRef.current;
    setEditSaving(true); setEditNotice("Saving…");
    try {
      const payload = { name: snapshot.name, description: snapshot.description, text_content: snapshot.text_content };
      const response = await apiFetch(`${API}/content/${editingContent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (request !== editRequestRef.current) return result.item;
      setItems((current) => current.map((entry) => entry.id === result.item.id ? result.item : entry));
      setSelected(result.item); onRouteOpen?.(result.item.id); setEditingContent(result.item);
      if (revision === editRevisionRef.current) setEditForm({ name: result.item.name || "", description: result.item.description || "", text_content: result.item.text_content || "", link_url: result.item.link_url || "" });
      setEditNotice("Saved");
      return result.item;
    } catch (_) {
      if (request === editRequestRef.current) setEditNotice("Couldn't save — Retry");
      return null;
    } finally { editInFlightRef.current = false; if (request === editRequestRef.current) setEditSaving(false); }
  }, [editingContent, canManage, editForm, onRouteOpen]);
  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingContent || !canManage) return;
    if (editingContent.content_type === "TEXT") { await persistExistingText(editForm, editRevisionRef.current); return; }
    setEditSaving(true); setEditNotice("");
    try {
      const response = await apiFetch(`${API}/content/${editingContent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editForm.name, description: editForm.description, link_url: editForm.link_url }) });
      const result = await response.json();
      setItems((current) => current.map((entry) => entry.id === result.item.id ? result.item : entry)); setSelected(result.item); onRouteOpen?.(result.item.id); setEditingContent(result.item); setEditForm({ name: result.item.name || "", description: result.item.description || "", text_content: result.item.text_content || "", link_url: result.item.link_url || "" }); setEditNotice("Changes saved");
    } catch (_) { setEditNotice("We couldn't save your changes. Please try again."); }
    finally { setEditSaving(false); }
  };
  useEffect(() => {
    if (!editingContent || editingContent.content_type !== "TEXT" || !editDirty || editSaving) return undefined;
    const snapshot = { ...editForm }; const revision = editRevisionRef.current;
    editAutosaveTimerRef.current = window.setTimeout(() => { void persistExistingText(snapshot, revision); }, 1000);
    return () => window.clearTimeout(editAutosaveTimerRef.current);
  }, [editingContent?.id, editingContent?.content_type, editForm, editDirty, editSaving, persistExistingText]);
  const persistNewText = async (snapshot = form) => {
    if (!canManage || type !== "TEXT" || newTextSaving || newTextInFlightRef.current || !String(snapshot.name || "").trim() || !String(snapshot.text_content || "").trim()) return null;
    newTextInFlightRef.current = true;
    const request = ++newTextRequestRef.current;
    setNewTextSaving(true); setNewTextNotice("Saving…");
    try {
      let result;
      if (creatingTextDraft) {
        const response = await apiFetch(`${API}/content/${creatingTextDraft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name:snapshot.name, description:snapshot.description, text_content:snapshot.text_content }) });
        result = await response.json();
      } else {
        const body = new FormData(); body.set("content_type", "TEXT"); body.set("name", snapshot.name); body.set("text_content", snapshot.text_content); if (snapshot.description) body.set("description", snapshot.description);
        const response = await apiFetch(`${API}/content`, { method: "POST", body }); result = await response.json();
      }
      if (request !== newTextRequestRef.current) return result.item;
      setCreatingTextDraft(result.item); setItems((current) => current.some((entry) => entry.id === result.item.id) ? current.map((entry) => entry.id === result.item.id ? result.item : entry) : [result.item, ...current]); setNewTextNotice("Saved");
      return result.item;
    } catch (_) { if (request === newTextRequestRef.current) setNewTextNotice("Couldn't save — Retry"); return null; }
    finally { newTextInFlightRef.current = false; if (request === newTextRequestRef.current) setNewTextSaving(false); }
  };
  useEffect(() => {
    if (!creating || type !== "TEXT" || !newTextDirty || newTextSaving || !String(form.name || "").trim() || !String(form.text_content || "").trim()) return undefined;
    const snapshot = { ...form };
    newTextAutosaveTimerRef.current = window.setTimeout(() => { void persistNewText(snapshot); }, 1000);
    return () => window.clearTimeout(newTextAutosaveTimerRef.current);
  }, [creating, type, form, newTextDirty, newTextSaving, creatingTextDraft]);
  useEffect(() => {
    contentAutosaveFlushRef.current = () => {
      if (editingContent?.content_type === "TEXT" && editDirty && !editSaving) void persistExistingText(editFormRef.current, editRevisionRef.current);
      if (creating && type === "TEXT" && newTextDirty && !newTextSaving) void persistNewText(form);
    };
  });
  useEffect(() => () => { contentAutosaveFlushRef.current(); }, []);
  useEffect(() => {
    const flush = () => { if (document.hidden) contentAutosaveFlushRef.current(); };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  const secureOpen = async (item) => {
    setActionError("");
    try {
      const response = await apiFetch(`${API}/content/${item.id}/download`);
      const result = await response.json();
      if (item.content_type === "IMAGE") setPreviewUrl(result.url);
      else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (openError) { setActionError(openError?.message || "We could not open this secure file."); }
  };
  const restore = async (item) => {
    try { const response=await apiFetch(`${API}/content/${item.id}/restore`, {method:"POST"}); const result=await response.json(); setItems(current=>current.map(entry=>entry.id===item.id?result.item:entry)); setSelected(result.item); }
    catch (restoreError) { setActionError(restoreError?.message || "We could not restore this content."); }
  };
  const permanentlyDelete = async () => {
    if (!deleteTarget || deletingContent) return;
    setDeletingContent(true); setDeleteError(""); setActionError("");
    try {
      const response = await apiFetch(`${API}/content/${deleteTarget.id}`, {method:"DELETE"});
      const result = await response.json();
      setItems(current=>current.filter(entry=>entry.id!==deleteTarget.id));
      if(selected?.id===deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      await load();
      if(result.storage_cleanup === "failed") setActionError(result.warning || "Content was deleted, but its private file needs cleanup.");
    } catch (failure) {
      const message = failure?.message || "We couldn't permanently delete this content.";
      setDeleteError(message); setActionError(message);
    } finally { setDeletingContent(false); }
  };
  const loadImageKnowledge = async (item) => {
    if (!item || item.content_type !== "IMAGE") return;
    setKnowledgeLoading(true);
    try { const response = await apiFetch(`${API}/content/${item.id}/knowledge-ingestions`); const result = await response.json(); setImageKnowledge(result.ingestions || []); }
    catch (loadError) { setActionError(loadError?.message || "We could not load image knowledge."); }
    finally { setKnowledgeLoading(false); }
  };
  useEffect(() => {
    if (selected?.content_type === "IMAGE") void loadImageKnowledge(selected);
    else setImageKnowledge([]);
  }, [selected?.id]);
  const extractKnowledge = async (item) => {
    setActionError(""); setKnowledgeLoading(true);
    try { const response = await apiFetch(`${API}/content/${item.id}/extract-knowledge`, { method: "POST" }); const result = await response.json(); setImageKnowledge((current) => [result.ingestion, ...current]); setKnowledgeForm({ extracted_text: result.ingestion.extracted_text || "", review_notes: (result.ingestion.review_notes || []).join("\n"), valid_from: "", valid_until: "" }); setReviewingKnowledge(result.ingestion); }
    catch (extractError) { setActionError(extractError?.message || "We could not analyze this image."); }
    finally { setKnowledgeLoading(false); }
  };
  const openReview = (run) => { setKnowledgeForm({ extracted_text: run.extracted_text || "", review_notes: (run.review_notes || []).join("\n"), valid_from: run.revision?.valid_from || "", valid_until: run.revision?.valid_until || "" }); setReviewingKnowledge(run); };
  const saveReview = async (approve = false) => {
    if (!reviewingKnowledge) return; setKnowledgeLoading(true); setActionError("");
    try {
      const payload = { extracted_text: knowledgeForm.extracted_text, review_notes: knowledgeForm.review_notes.split("\n").map((note) => note.trim()).filter(Boolean) };
      if (!approve) await apiFetch(`${API}/content/knowledge-ingestions/${reviewingKnowledge.id}/review`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const response = approve ? await apiFetch(`${API}/content/knowledge-ingestions/${reviewingKnowledge.id}/approve`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...payload, valid_from:knowledgeForm.valid_from || null, valid_until:knowledgeForm.valid_until || null }) }) : null;
      if (response) { const result=await response.json(); setImageKnowledge((current)=>current.map((run)=>run.id===result.ingestion.id?result.ingestion:run)); setReviewingKnowledge(result.ingestion); }
      else { await loadImageKnowledge(selected); }
    } catch (reviewError) { setActionError(reviewError?.message || "We couldn't save your changes. Please try again."); }
    finally { setKnowledgeLoading(false); }
  };
  const rejectKnowledge = async () => { if (!reviewingKnowledge) return; try { await apiFetch(`${API}/content/knowledge-ingestions/${reviewingKnowledge.id}/reject`,{method:"POST"}); setReviewingKnowledge(null); await loadImageKnowledge(selected); } catch (rejectError) { setActionError(rejectError?.message || "We could not reject this extraction."); } };

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
  const icon = (contentType) => ({ TEXT: "file", DOCUMENT: "file", IMAGE: "image", LINK: "link", WHATSAPP_TEMPLATE_REFERENCE: "template" }[contentType] || "file");
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
      <div style={{display:"flex",gap:6}}>{[["active","Active"],["archived","Archived"],["all","All"]].map(([value,label])=><button key={value} className={lifecycleFilter===value?"btn btn-gold":"btn btn-wire"} onClick={()=>{setLifecycleFilter(value);setSelected(null)}} style={{padding:"7px 10px",fontSize:10}}>{label}</button>)}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>{filters.map(([key, label]) => <button key={key} className={filter === key ? "btn btn-gold" : "btn btn-wire"} onClick={() => setFilter(key)} style={{ padding: "7px 10px", fontSize: 10 }}>{label}</button>)}</div>
      <input className="input" aria-label="Search Content Library" placeholder="Search content" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 210 }} />
    </div>
    {loading ? <Loader /> : error ? <div className="card" role="alert" style={{ padding: 20, color: "var(--error-text)" }}>{error}</div> : !visible.length ? <div className="card" style={{ padding: 28, color: "var(--mist)", textAlign: "center" }}>No content saved here yet.{canManage ? " Add a reusable message, file, link or WhatsApp template reference." : ""}</div> : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(270px, .8fr)", gap: 16 }}>
      <div className="card" style={{ overflow: "hidden" }}>{visible.map((item) => <button key={item.id} onClick={() => { setSelected(item); onRouteOpen?.(item.id); }} style={{ width: "100%", textAlign: "left", background: selected?.id === item.id ? "rgba(196,154,61,.08)" : "transparent", border: 0, borderBottom: "1px solid var(--wire)", padding: "15px 17px", cursor: "pointer", color: "inherit", display: "flex", gap: 12 }}>
        <div aria-label={typeLabel(item.content_type)} style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "1px solid var(--wire2)", color: "var(--gold2)", flexShrink: 0 }}><Ic n={icon(item.content_type)} s={15} c="currentColor" /></div>
        <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--cream)", fontWeight: 600, fontSize: 13 }}>{item.name}</div><div style={{ color: "var(--mist)", fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview(item)}</div></div>
        <span className="mono" style={{ color: "var(--gold2)", fontSize: 8, letterSpacing: 1, alignSelf: "center" }}>{typeLabel(item.content_type)}</span>
      </button>)}</div>
      <div className="card" style={{ padding: 20, minHeight: 230 }}>{!selected ? <div style={{ color: "var(--mist)", fontSize: 12 }}>Choose an item to view its details.</div> : <>
        <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 1.5 }}>{typeLabel(selected.content_type)}</div><h3 className="editorial" style={{ color: "var(--cream)", fontSize: 21, marginTop: 7 }}>{selected.name}</h3>
        {selected.description && <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>{selected.description}</p>}
        {selected.content_type === "TEXT" && <div style={{ whiteSpace: "pre-wrap", color: "var(--cream2)", fontSize: 12, lineHeight: 1.55, marginTop: 15 }}>{selected.text_content}</div>}
        {selected.content_type === "LINK" && <a href={selected.link_url} target="_blank" rel="noreferrer" style={{ color: "var(--gold2)", display: "block", fontSize: 12, marginTop: 15, wordBreak: "break-all" }}>{selected.link_url}</a>}
        {["DOCUMENT","IMAGE"].includes(selected.content_type) && <><button className="btn btn-wire" onClick={() => secureOpen(selected)} style={{ marginTop: 16 }}>{selected.content_type === "IMAGE" ? "Preview secure image" : "Open secure document"}</button>{selected.content_type === "IMAGE" && previewUrl && <img src={previewUrl} alt={selected.name} style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "contain", marginTop: 14, border: "1px solid var(--wire)" }} />}</>}
        {selected.content_type === "IMAGE" && <div style={{marginTop:16}}>{(() => { const run=imageKnowledge[0]; const busy=knowledgeLoading || ["pending","processing"].includes(run?.status); if(!run) return canManage && <button className="btn btn-gold" disabled={busy} onClick={()=>extractKnowledge(selected)}>Extract knowledge for Zoe</button>; if(["pending","processing"].includes(run.status)) return <button className="btn btn-wire" disabled>Extracting…</button>; if(run.status==="ready_for_review") return <><button className="btn btn-gold" onClick={()=>openReview(run)}>Review Zoe knowledge</button><button className="btn btn-wire" onClick={()=>loadImageKnowledge(selected)} style={{marginLeft:8}}>Refresh</button></>; if(run.status==="approved") return <><button className="btn btn-wire" onClick={()=>loadImageKnowledge(selected)}>View Zoe knowledge</button>{canManage && <button className="btn btn-gold" onClick={()=>extractKnowledge(selected)} style={{marginLeft:8}}>Extract again</button>}</>; return canManage && <button className="btn btn-gold" disabled={busy} onClick={()=>extractKnowledge(selected)}>Retry extraction</button>; })()}</div>}
        {selected.content_type === "WHATSAPP_TEMPLATE_REFERENCE" && <><div style={{ color: "var(--cream2)", fontSize: 12, marginTop: 15 }}>{selected.template_name} · {selected.template_language || "language unavailable"} · {selected.template_status || "status unavailable"}</div>{canManage && <button className="btn btn-wire" onClick={() => refreshTemplate(selected)} style={{ marginTop: 13 }}>Refresh from Meta</button>}</>}
        {canManage && ["TEXT", "LINK"].includes(selected.content_type) && <button className="btn btn-wire" onClick={() => beginEdit(selected)} style={{ marginTop: 18 }}>Edit</button>}
        {canManage && !selected.archived_at && <button className="btn btn-wire" onClick={() => archive(selected)} style={{ marginTop: 18, marginLeft: ["TEXT", "LINK"].includes(selected.content_type) ? 8 : 0, color: "var(--error-text)", borderColor: "rgba(239,68,68,.35)" }}>Archive content</button>}
        {canManage && selected.archived_at && <button className="btn btn-wire" onClick={() => restore(selected)} style={{ marginTop: 18 }}>Restore content</button>}
        {canManage && <button className="btn btn-wire" onClick={() => { setDeleteError(""); setDeleteTarget(selected); }} style={{ marginTop: 18, marginLeft: 8, color: "var(--error-text)", borderColor: "rgba(239,68,68,.35)" }}>More actions · Delete permanently</button>}
      </>}</div>
    </div>}

    {deleteTarget && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Delete content permanently"><div className="modal" style={{maxWidth:520}}><div className="mono" style={{color:"var(--error-text)"}}>PERMANENT DELETION</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:25,marginTop:8}}>Delete “{deleteTarget.name}” permanently?</h3><p style={{color:"var(--cream2)",lineHeight:1.5}}>This cannot be undone. ZedPing will only delete it if it is not needed by an automation, AI configuration, or knowledge history.</p>{deleteError && <div role="alert" style={{marginTop:14,padding:12,border:"1px solid rgba(239,68,68,.35)",color:"var(--error-text)",fontSize:12,lineHeight:1.5}}>{deleteError}</div>}<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button className="btn btn-wire" disabled={deletingContent} onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="btn btn-wire" disabled={deletingContent} style={{color:"var(--error-text)",borderColor:"rgba(239,68,68,.35)"}} onClick={permanentlyDelete}>{deletingContent ? "Deleting…" : "Delete permanently"}</button></div></div></div>}
    {editingContent && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Edit content"><div className="modal" style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2 }}>CONTENT LIBRARY</div><h3 className="editorial" style={{ color: "var(--cream)", fontSize: 24, marginTop: 7 }}>Edit {typeLabel(editingContent.content_type)}</h3></div><button type="button" className="btn btn-wire" onClick={closeEdit}>Close</button></div>
      <form onSubmit={saveEdit} style={{ marginTop: 20 }}>
        <label className="label">Name</label><input className="input" required maxLength="160" value={editForm.name} onChange={(event) => { editRevisionRef.current += 1; setEditForm((current) => ({ ...current, name: event.target.value })); }} />
        <label className="label" style={{ marginTop: 13 }}>Description <span style={{ color: "var(--mist)" }}>optional</span></label><input className="input" maxLength="500" value={editForm.description} onChange={(event) => { editRevisionRef.current += 1; setEditForm((current) => ({ ...current, description: event.target.value })); }} />
        {editingContent.content_type === "TEXT" && <><label className="label" style={{ marginTop: 13 }}>Content</label><textarea className="textarea" required maxLength="20000" value={editForm.text_content} onChange={(event) => { editRevisionRef.current += 1; setEditForm((current) => ({ ...current, text_content: event.target.value })); }} /><div style={{ color: "var(--mist)", fontSize: 10, textAlign: "right" }}>{editForm.text_content.length}/20,000</div></>}
        {editingContent.content_type === "LINK" && <><label className="label" style={{ marginTop: 13 }}>Destination URL</label><input className="input" type="url" required value={editForm.link_url} onChange={(event) => setEditForm((current) => ({ ...current, link_url: event.target.value }))} /></>}
        {editNotice && <div role="status" style={{ color: ["Changes saved", "Saved", "Saving…"].includes(editNotice) ? "var(--gold2)" : "var(--error-text)", fontSize: 12, marginTop: 13 }}>{editNotice}{editNotice === "Couldn't save — Retry" && <button type="button" className="btn btn-wire" style={{ marginLeft: 10, padding: "4px 7px", fontSize: 9 }} onClick={() => void persistExistingText(editForm, editRevisionRef.current)}>Retry</button>}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 10 }}><button type="button" className="btn btn-wire" onClick={closeEdit} disabled={editSaving}>Cancel</button><button type="submit" className="btn btn-gold" disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div></div>}
    {reviewingKnowledge && <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Review image knowledge"><div className="modal" style={{maxWidth:820,maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><div className="mono" style={{color:"var(--gold2)",fontSize:9,letterSpacing:2}}>ZOE KNOWLEDGE</div><h3 className="editorial" style={{color:"var(--cream)",fontSize:24,marginTop:7}}>Needs your confirmation</h3></div><button className="btn btn-wire" onClick={()=>setReviewingKnowledge(null)}>Close</button></div><div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:16,marginTop:16}}><div><div className="label">Original image</div>{previewUrl ? <img src={previewUrl} alt={selected?.name || "Original image"} style={{width:"100%",maxHeight:300,objectFit:"contain",border:"1px solid var(--wire)"}} /> : <button className="btn btn-wire" onClick={()=>secureOpen(selected)}>Preview secure image</button>}</div><div><label className="label">Information found</label><textarea className="textarea" maxLength="20000" value={knowledgeForm.extracted_text} onChange={e=>setKnowledgeForm(current=>({...current,extracted_text:e.target.value}))}/><label className="label" style={{marginTop:12}}>Needs your confirmation</label><textarea className="textarea" placeholder="One uncertainty per line" value={knowledgeForm.review_notes} onChange={e=>setKnowledgeForm(current=>({...current,review_notes:e.target.value}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}><label className="label">Valid from <input className="input" type="date" value={knowledgeForm.valid_from} onChange={e=>setKnowledgeForm(current=>({...current,valid_from:e.target.value}))}/></label><label className="label">Valid until <input className="input" type="date" value={knowledgeForm.valid_until} onChange={e=>setKnowledgeForm(current=>({...current,valid_until:e.target.value}))}/></label></div></div></div><div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:18}}><button className="btn btn-wire" onClick={rejectKnowledge}>Reject</button><button className="btn btn-wire" onClick={()=>saveReview(false)}>Save changes</button><button className="btn btn-gold" onClick={()=>saveReview(true)}>Approve for Zoe</button></div></div></div>}
    {creating && <div className="modal-bg"><div className="modal" style={{ maxWidth: 620 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2 }}>CONTENT LIBRARY</div><h3 className="editorial" style={{ color: "var(--cream)", fontSize: 24, marginTop: 7 }}>{type ? "Add " + typeLabel(type) : "What would you like to save?"}</h3></div><button className="btn btn-wire" onClick={() => { setCreating(false); setType(null); }}>Close</button></div>
      {!type ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>{[["TEXT","Text"],["DOCUMENT","Document"],["IMAGE","Image"],["LINK","Link"],["WHATSAPP_TEMPLATE_REFERENCE","WhatsApp Template"]].map(([key,label]) => <button key={key} className="btn btn-wire" onClick={() => begin(key)} style={{ minHeight: 72, justifyContent: "center" }}>{label}</button>)}</div> :
      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <label className="label">Name</label><input className="input" required maxLength="160" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Give this content a clear name" />
        <label className="label" style={{ marginTop: 13 }}>Description <span style={{ color: "var(--mist)" }}>optional</span></label><input className="input" maxLength="500" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A short note for your team" />
        {type === "TEXT" && <><label className="label" style={{ marginTop: 13 }}>Content</label><textarea className="textarea" required maxLength="20000" value={form.text_content} onChange={(event) => setForm((current) => ({ ...current, text_content: event.target.value }))} placeholder="Write reusable information for your team" /><div style={{ color: "var(--mist)", fontSize: 10, textAlign: "right" }}>{form.text_content.length}/20,000</div>{newTextNotice && <div role="status" style={{ color: ["Saved", "Saving…"].includes(newTextNotice) ? "var(--gold2)" : "var(--error-text)", fontSize: 12, marginTop: 10 }}>{newTextNotice}{newTextNotice === "Couldn't save — Retry" && <button type="button" className="btn btn-wire" style={{ marginLeft: 10, padding: "4px 7px", fontSize: 9 }} onClick={() => void persistNewText(form)}>Retry</button>}</div>}</>}
        {type === "LINK" && <><label className="label" style={{ marginTop: 13 }}>Destination URL</label><input className="input" type="url" required value={form.link_url} onChange={(event) => setForm((current) => ({ ...current, link_url: event.target.value }))} placeholder="https://…" /></>}
        {["DOCUMENT","IMAGE"].includes(type) && <><label className="label" style={{ marginTop: 13 }}>{type === "IMAGE" ? "Image file" : "Document file"}</label><input className="input" type="file" required accept={type === "IMAGE" ? "image/jpeg,image/png,image/webp" : ".pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"} onChange={(event) => setFile(event.target.files?.[0] || null)} /><div style={{ color: "var(--mist)", fontSize: 10, marginTop: 6 }}>Allowed types only, up to 10 MB. Files stay private to this workspace.</div></>}
        {type === "WHATSAPP_TEMPLATE_REFERENCE" && <><label className="label" style={{ marginTop: 13 }}>Live WhatsApp template</label>{templateError ? <div role="alert" style={{ color: "var(--error-text)", fontSize: 12 }}>{templateError}</div> : <select className="input" required value={form.template_id} onChange={(event) => setForm((current) => ({ ...current, template_id: event.target.value }))}><option value="">Choose a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.status} · {template.language}</option>)}</select>}<div style={{ color: "var(--mist)", fontSize: 10, marginTop: 6 }}>This saves a validated reference, not a copy of the Meta template.</div></>}
        {actionError && <div role="alert" style={{ color: "var(--error-text)", fontSize: 12, marginTop: 13 }}>{actionError}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 10 }}><button type="button" className="btn btn-wire" onClick={() => setType(null)}>Back</button><button type="submit" className="btn btn-gold" disabled={saving || newTextSaving || (type === "WHATSAPP_TEMPLATE_REFERENCE" && !!templateError)}>{saving || newTextSaving ? (["DOCUMENT","IMAGE"].includes(type) ? "Uploading…" : "Saving…") : "Save content"}</button></div>
      </form>}
    </div></div>}
  </div>
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const invitationTokenRef = useRef(pendingInvitationToken());
  const invitationValidityRef = useRef(invitationTokenRef.current ? "pending" : "none");
  const invitationPreviewRef = useRef(Promise.resolve());
  const invitationContextRef = useRef(null);
  const authLoadRef = useRef(null);
  const [view, setView] = useState(invitationTokenRef.current || window.location.search.includes("signup") ? "signup" : "login");
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceChanging, setWorkspaceChanging] = useState(false);
  const [workspaceSwitchTarget, setWorkspaceSwitchTarget] = useState(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [route, setRoute] = useState(() => parseDashboardRoute(window.location.pathname));
  const active = route.section;
  const navigate = useCallback((next, { replace = false } = {}) => {
    const nextRoute = typeof next === "string" ? { section: next, resourceId: null, resourceKind: null } : next;
    const pathname = routeToPath(nextRoute);
    if (pathname !== window.location.pathname) window.history[replace ? "replaceState" : "pushState"](null, "", pathname);
    setRoute(parseDashboardRoute(pathname));
  }, []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [invitationAccountMismatch, setInvitationAccountMismatch] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationTokenRef.current));
  const [whatsappConnectionState, setWhatsAppConnectionState] = useState(null);
  const [reset, setReset] = useState(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    return hash.includes("type=recovery") || search.includes("type=recovery") || (hash.includes("access_token") && hash.includes("recovery"));
  });

  useEffect(() => {
    const onPopState = () => setRoute(parseDashboardRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const token = invitationTokenRef.current;
    if (!token) { setInvitationLoading(false); return; }
    let cancelled = false;
    const preview = previewInvitation(token)
      .then(context => {
        invitationValidityRef.current = "valid";
        invitationContextRef.current = context;
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
        const accountState = invitationAccountState(invitationContextRef.current?.email, sessionUser.email);
        if (token && accountState === "different_session") {
          setInvitationAccountMismatch(true);
          setCustomer(null); setWorkspaces([]); setNeedsVerification(false); setWorkspaceSwitchTarget(null); setWorkspaceChanging(false);
          return;
        }
        setInvitationAccountMismatch(false);
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
        setCustomer(verified.workspace); setNeedsVerification(false); setWorkspaceSwitchTarget(null); setWorkspaceChanging(false);
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
        setInvitationAccountMismatch(false);
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
    // A resource belongs to the previous workspace. Keep only its safe parent section.
    if (isResourceRoute(route)) navigate(safeParentRoute(route), { replace: true });
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

  const signOutAndContinueInvitation = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setUser(null); setCustomer(null); setWorkspaces([]); setNeedsVerification(false); setWorkspaceChanging(false); setWorkspaceSwitchTarget(null); setInvitationAccountMismatch(false); setView("signup");
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setUser(null); setCustomer(null); setWorkspaces([]); setNeedsVerification(false); setWorkspaceChanging(false); setWorkspaceSwitchTarget(null);
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
    overview:    { title: "Overview",     comp: <Overview customer={customer} user={user} onNavigate={navigate} whatsappConnectionState={whatsappConnectionState?.workspaceId === customer?.id ? whatsappConnectionState : null} /> },
    broadcasts:  { title: "Broadcasts",   comp: <Broadcasts customer={customer} /> },
    contacts:    { title: "Contacts",     comp: <Contacts customer={customer} /> },
    contactGroups: { title: "Contact Groups", comp: <Contacts customer={customer} initialTab="groups" routeGroupId={route.resourceKind === "contactGroup" ? route.resourceId : null} onRouteOpen={(resourceId) => navigate({ section: "contactGroups", resourceId, resourceKind: "contactGroup" })} onRouteUnavailable={() => navigate({ section: "contactGroups", resourceId: null, resourceKind: null }, { replace: true })} /> },
    messages:    { title: "Team Inbox",   comp: <TeamInbox customer={customer} user={user} /> },
    automations: { title: "Automations",  comp: <Automations customer={customer} /> },
    chatbotFlows: { title: "Chatbot Flows", comp: <ChatbotFlows customer={customer} routeFlowId={route.resourceKind === "flow" ? route.resourceId : null} onRouteOpen={(resourceId) => navigate({ section: "chatbotFlows", resourceId, resourceKind: "flow" })} onRouteUnavailable={() => navigate({ section: "chatbotFlows", resourceId: null, resourceKind: null }, { replace: true })} apiFetch={(path: string, init: RequestInit = {}) => apiFetch(API + path, init)} /> },
    zoeAi: { title: "Zoe AI", comp: <ZoeAI customer={customer} routeAgentId={route.resourceKind === "agent" ? route.resourceId : null} onRouteOpen={(resourceId) => navigate({ section: "zoeAi", resourceId, resourceKind: "agent" })} onRouteUnavailable={() => navigate({ section: "zoeAi", resourceId: null, resourceKind: null }, { replace: true })} apiFetch={(path: string, init: RequestInit = {}) => apiFetch(API + path, init)} /> },
    templates:   { title: "WhatsApp Templates", comp: <WhatsAppTemplates customer={customer} /> },
    content:     { title: "Content Library", comp: <ContentLibrary customer={customer} routeContentId={route.resourceKind === "content" ? route.resourceId : null} onRouteOpen={(resourceId) => navigate({ section: "content", resourceId, resourceKind: "content" })} onRouteUnavailable={() => navigate({ section: "content", resourceId: null, resourceKind: null }, { replace: true })} /> },
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
  if (invitationAccountMismatch && invitation?.email && user) return <><style>{css}</style><InvitationAccountMismatch invitation={invitation} onSignOut={signOutAndContinueInvitation} /></>;

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
        <Sidebar active={active} setActive={navigate} user={user} customer={customer} onLogout={onLogout} open={open} onClose={() => setOpen(false)} />
        <div className="main workspace">
          <MobTopbar onMenu={() => setOpen(true)} onLogout={onLogout} workspaces={workspaces} activeWorkspaceId={customer?.id || workspaceSwitchTarget} onWorkspaceChange={onWorkspaceChange} switching={workspaceChanging} />
          <Topbar title={cur.title} user={user} customer={customer} workspaces={workspaces} onWorkspaceChange={onWorkspaceChange} activeWorkspaceId={customer?.id || workspaceSwitchTarget} switching={workspaceChanging} />
          {workspaceChanging ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }} role="status" aria-live="polite"><div className="spin" style={{ width: 24, height: 24 }} /><div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Loading workspace</div></div> : <div key={customer?.id} style={{ flex: 1, overflowY: "auto" }}>{cur.comp}</div>}
        </div>
      </div>
    </>
  );
}
