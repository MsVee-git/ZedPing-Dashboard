import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zzhqhgeyxbdqdkacrviq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHFoZ2V5eGJkcWRrYWNydmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMwNDEsImV4cCI6MjA5NDU3OTA0MX0.C4xDheJF3qOB7L3LWZKryNgE4-eMc05kJi4qwDhp-sI";
const API = "https://zedping-backend-production.up.railway.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const BG      = "#0B1020";
const SURFACE = "#121A2B";
const SURFACE2= "#1A2235";
const INDIGO  = "#5B5BD6";
const INDIGO2 = "#7B6FE8";
const CYAN    = "#5EE6FF";
const TEXT1   = "#F5F7FA";
const TEXT2   = "#9CA3AF";
const BORDER  = "rgba(255,255,255,0.07)";
const SUCCESS = "#22C55E";
const DANGER  = "#EF4444";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${BG}; color: ${TEXT1}; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.18s; border: none; font-family: inherit; width: 100%; }
  .btn-primary { background: ${INDIGO}; color: white; }
  .btn-primary:hover { background: #4A4ABF; box-shadow: 0 4px 16px rgba(91,91,214,0.3); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-ghost { background: rgba(255,255,255,0.06); color: ${TEXT1}; border: 1px solid ${BORDER}; }
  .btn-ghost:hover { background: rgba(255,255,255,0.1); }
  .btn-danger { background: rgba(239,68,68,0.1); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.2); }

  .input { background: ${SURFACE2}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: ${TEXT1}; outline: none; font-family: inherit; transition: border-color 0.2s; width: 100%; }
  .input:focus { border-color: rgba(91,91,214,0.5); box-shadow: 0 0 0 3px rgba(91,91,214,0.1); }
  .input::placeholder { color: ${TEXT2}; }

  .textarea { background: ${SURFACE2}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: ${TEXT1}; outline: none; font-family: inherit; transition: border-color 0.2s; width: 100%; resize: vertical; min-height: 90px; }
  .textarea:focus { border-color: rgba(91,91,214,0.5); }

  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .badge-green { background: rgba(34,197,94,0.1); color: #86EFAC; border: 1px solid rgba(34,197,94,0.2); }
  .badge-yellow { background: rgba(245,158,11,0.1); color: #FCD34D; border: 1px solid rgba(245,158,11,0.2); }
  .badge-blue { background: rgba(91,91,214,0.1); color: #A5A5FF; border: 1px solid rgba(91,91,214,0.2); }
  .badge-red { background: rgba(239,68,68,0.1); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.2); }

  .tab { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; background: transparent; color: ${TEXT2}; font-family: inherit; }
  .tab.active { background: rgba(91,91,214,0.15); color: ${TEXT1}; }
  .tab:hover:not(.active) { color: ${TEXT1}; }

  .card { background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; }
  .card-hover { transition: border-color 0.2s, transform 0.2s; }
  .card-hover:hover { border-color: rgba(91,91,214,0.3); transform: translateY(-2px); }

  .table-row { display: grid; padding: 12px 16px; border-bottom: 1px solid ${BORDER}; font-size: 13px; align-items: center; transition: background 0.15s; }
  .table-row:last-child { border-bottom: none; }
  .table-row:hover { background: rgba(255,255,255,0.02); }

  .progress-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, ${INDIGO}, ${CYAN}); }

  .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${INDIGO}; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .sidebar-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-weight: 500; color: ${TEXT2}; cursor: pointer; transition: all 0.15s; border: none; background: transparent; width: 100%; text-align: left; font-family: inherit; }
  .sidebar-link:hover { background: rgba(255,255,255,0.05); color: ${TEXT1}; }
  .sidebar-link.active { background: rgba(91,91,214,0.15); color: ${TEXT1}; }

  /* MOBILE RESPONSIVE */
  .sidebar { width: 220px; background: ${SURFACE}; border-right: 1px solid ${BORDER}; display: flex; flex-direction: column; height: 100vh; position: fixed; top: 0; left: 0; z-index: 100; transition: transform 0.3s ease; }
  .main-content { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .mobile-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99; }
  .mobile-topbar { display: none; }

  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.open { transform: translateX(0); }
    .mobile-overlay.show { display: block; }
    .main-content { margin-left: 0; }
    .mobile-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; height: 56px; background: ${SURFACE}; border-bottom: 1px solid ${BORDER}; position: sticky; top: 0; z-index: 50; }
    .desktop-topbar { display: none !important; }
    .page-content { padding: 16px !important; }
    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
    .overview-grid { grid-template-columns: 1fr !important; }
    .plan-grid { grid-template-columns: 1fr !important; }
    .table-hide-mobile { display: none !important; }
    .auth-card { padding: 24px 20px !important; }
    .hide-mobile { display: none !important; }
  }

  .label { font-size: 12px; font-weight: 600; color: ${TEXT2}; margin-bottom: 6px; display: block; }
  .error-msg { color: #FCA5A5; font-size: 12px; margin-top: 6px; }
  .success-msg { color: #86EFAC; font-size: 12px; margin-top: 6px; }
  .link { color: ${INDIGO}; cursor: pointer; font-weight: 600; }
  .link:hover { text-decoration: underline; }
  .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
  .divider-line { flex: 1; height: 1px; background: ${BORDER}; }
  .divider-text { font-size: 12px; color: ${TEXT2}; }
`;

// ── ICONS ──────────────────────────────────────────────────────────────────
const I = ({ n, s = 16, c = "currentColor" }) => {
  const icons = {
    home: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    broadcast: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
    contacts: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    messages: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    auto: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    settings: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    plus: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
    send: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    upload: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    search: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    menu: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    x: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    logout: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    refresh: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    eye: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    eyeoff: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  };
  return icons[n] || null;
};

function Loader() {
  return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" /></div>;
}

function Empty({ msg = "Nothing here yet" }) {
  return <div style={{ textAlign: "center", padding: "48px 24px", color: TEXT2, fontSize: 14 }}>{msg}</div>;
}

// ── API HOOK ───────────────────────────────────────────────────────────────
function useAPI(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}${endpoint}`);
      const json = await res.json();
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch_(); }, deps);
  return { data, loading, error, refetch: fetch_ };
}

// ── AUTH PAGES ─────────────────────────────────────────────────────────────
function AuthLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: `radial-gradient(ellipse, rgba(91,91,214,0.15) 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 460, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, background: INDIGO, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 20 }}>Z</span>
              <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: CYAN, boxShadow: `0 0 6px ${CYAN}` }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 22, color: TEXT1 }}>Zed<span style={{ color: CYAN }}>Ping</span></span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SignUp({ onSwitch, onAuth }) {
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "", password: "" });
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignUp = async () => {
    if (!form.name || !form.business_name || !form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            business_name: form.business_name,
            phone: form.phone,
            subscription_plan: plan,
          }
        }
      });
      if (authError) throw authError;
      if (data.user) {
        await supabase.from("customers").insert({
          auth_user_id: data.user.id,
          business_name: form.business_name,
          email: form.email,
          phone: form.phone,
          subscription_plan: plan,
          subscription_status: "trial",
        });
        onAuth(data.user, { business_name: form.business_name, name: form.name, plan });
      }
    } catch (e) {
      setError(e.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const PLANS = [
    { id: "starter", name: "Starter", price: "K650/mo", desc: "500 msgs · 2 automations" },
    { id: "business", name: "Business", price: "K1,500/mo", desc: "3,000 msgs · AI agent", popular: true },
    { id: "pro", name: "Pro", price: "K2,500/mo", desc: "Unlimited · Multiple agents" },
  ];

  return (
    <AuthLayout>
      <div className="card auth-card" style={{ padding: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT1, marginBottom: 6, letterSpacing: -0.5 }}>Create your account</h2>
        <p style={{ color: TEXT2, fontSize: 14, marginBottom: 24 }}>7-day free trial. No credit card required.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Your Name *</label>
              <input className="input" placeholder="Veronica" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div>
              <label className="label">Business Name *</label>
              <input className="input" placeholder="Sunrise Medical" value={form.business_name} onChange={e => set("business_name", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input className="input" type="email" placeholder="you@business.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp / Phone Number</label>
            <input className="input" placeholder="+260971234567" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">Password *</label>
            <div style={{ position: "relative" }}>
              <input className="input" type={showPass ? "text" : "password"} placeholder="Min 6 characters" value={form.password} onChange={e => set("password", e.target.value)} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TEXT2 }}>
                <I n={showPass ? "eyeoff" : "eye"} s={16} c={TEXT2} />
              </button>
            </div>
          </div>

          <div>
            <label className="label">Choose Plan</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {PLANS.map(p => (
                <div key={p.id} onClick={() => setPlan(p.id)} style={{ background: plan === p.id ? "rgba(91,91,214,0.15)" : SURFACE2, border: `1px solid ${plan === p.id ? "rgba(91,91,214,0.4)" : BORDER}`, borderRadius: 10, padding: "10px 10px", cursor: "pointer", textAlign: "center", transition: "all 0.15s", position: "relative" }}>
                  {p.popular && <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", background: INDIGO, color: "white", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, whiteSpace: "nowrap" }}>POPULAR</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: plan === p.id ? CYAN : TEXT2, fontWeight: 600, marginBottom: 2 }}>{p.price}</div>
                  <div style={{ fontSize: 10, color: TEXT2 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary" onClick={handleSignUp} disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <div className="spinner" /> : "Start Free Trial →"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: TEXT2, fontSize: 13, marginTop: 20 }}>
          Already have an account? <span className="link" onClick={onSwitch}>Sign in</span>
        </p>
      </div>
    </AuthLayout>
  );
}

function Login({ onSwitch, onAuth }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (authError) throw authError;
      const { data: customer } = await supabase.from("customers").select("*").eq("auth_user_id", data.user.id).single();
      onAuth(data.user, customer || {});
    } catch (e) {
      setError(e.message === "Invalid login credentials" ? "Incorrect email or password." : e.message);
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!form.email) { setError("Enter your email first."); return; }
    await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: window.location.origin });
    setResetSent(true);
  };

  return (
    <AuthLayout>
      <div className="card auth-card" style={{ padding: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT1, marginBottom: 6, letterSpacing: -0.5 }}>Welcome back</h2>
        <p style={{ color: TEXT2, fontSize: 14, marginBottom: 24 }}>Sign in to your ZedPing dashboard.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" placeholder="you@business.com" value={form.email} onChange={e => set("email", e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>Password</label>
              <span className="link" style={{ fontSize: 12 }} onClick={handleReset}>Forgot password?</span>
            </div>
            <div style={{ position: "relative" }}>
              <input className="input" type={showPass ? "text" : "password"} placeholder="Your password" value={form.password} onChange={e => set("password", e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                <I n={showPass ? "eyeoff" : "eye"} s={16} c={TEXT2} />
              </button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {resetSent && <div className="success-msg">Password reset email sent. Check your inbox.</div>}

          <button className="btn btn-primary" onClick={handleLogin} disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <div className="spinner" /> : "Sign In →"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: TEXT2, fontSize: 13, marginTop: 20 }}>
          Don't have an account? <span className="link" onClick={onSwitch}>Sign up free</span>
        </p>
      </div>
    </AuthLayout>
  );
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, customer, onLogout, open, onClose }) {
  const links = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "broadcasts", label: "Broadcasts", icon: "broadcast" },
    { id: "contacts", label: "Contacts", icon: "contacts" },
    { id: "messages", label: "Message Log", icon: "messages" },
    { id: "automations", label: "Automations", icon: "auto" },
    { id: "settings", label: "Account & Billing", icon: "settings" },
  ];

  const initial = (customer?.business_name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <>
      <div className={`mobile-overlay ${open ? "show" : ""}`} onClick={onClose} />
      <div className={`sidebar ${open ? "open" : ""}`}>
        <div style={{ padding: "18px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, background: INDIGO, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 16 }}>Z</span>
              <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: CYAN, boxShadow: `0 0 5px ${CYAN}` }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, color: TEXT1 }}>Zed<span style={{ color: CYAN }}>Ping</span></span>
          </div>
        </div>

        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer?.business_name || "My Business"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: SUCCESS, display: "inline-block" }} />
                <span style={{ fontSize: 10, color: TEXT2, textTransform: "capitalize" }}>{customer?.subscription_plan || "Starter"} Plan</span>
              </div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {links.map(l => (
            <button key={l.id} className={`sidebar-link ${active === l.id ? "active" : ""}`} onClick={() => { setActive(l.id); onClose(); }}>
              <span style={{ color: active === l.id ? INDIGO : TEXT2, flexShrink: 0 }}><I n={l.icon} s={15} c="currentColor" /></span>
              {l.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "10px 8px", borderTop: `1px solid ${BORDER}` }}>
          <button className="sidebar-link" onClick={onLogout} style={{ color: "#FCA5A5" }}>
            <I n="logout" s={15} c="#FCA5A5" /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

// ── DESKTOP TOPBAR ─────────────────────────────────────────────────────────
function Topbar({ title, user, customer }) {
  const initial = (customer?.business_name || user?.email || "U").charAt(0).toUpperCase();
  return (
    <div className="desktop-topbar" style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${BORDER}`, background: "rgba(18,26,43,0.9)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT1, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{customer?.business_name || "My Business"}</div>
          <div style={{ fontSize: 11, color: TEXT2 }}>{user?.email}</div>
        </div>
        <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{initial}</div>
      </div>
    </div>
  );
}

// ── MOBILE TOPBAR ──────────────────────────────────────────────────────────
function MobileTopbar({ title, onMenuOpen }) {
  return (
    <div className="mobile-topbar">
      <button onClick={onMenuOpen} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT1, padding: 4 }}>
        <I n="menu" s={22} c={TEXT1} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, background: INDIGO, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontWeight: 900, fontSize: 13 }}>Z</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: TEXT1 }}>Zed<span style={{ color: CYAN }}>Ping</span></span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>{title}</div>
    </div>
  );
}

// ── OVERVIEW ───────────────────────────────────────────────────────────────
function Overview({ customer }) {
  const { data: messages, loading: mL } = useAPI("/messages");
  const { data: contacts, loading: cL } = useAPI("/contacts");
  const { data: automations } = useAPI("/automations");
  const { data: broadcasts } = useAPI("/broadcasts/scheduled");

  const todayOut = (messages || []).filter(m => {
    const d = new Date(m.created_at);
    return d.toDateString() === new Date().toDateString() && m.direction === "outbound";
  }).length;

  const stats = [
    { label: "Sent Today", value: mL ? "--" : todayOut, color: CYAN, icon: "📨" },
    { label: "Contacts", value: cL ? "--" : (contacts?.length || 0), color: INDIGO, icon: "👥" },
    { label: "Active Keywords", value: (automations || []).filter(a => a.is_active && a.trigger_type === "keyword").length, color: "#A78BFA", icon: "🤖" },
    { label: "Scheduled", value: (broadcasts || []).filter(b => b.status === "pending").length, color: SUCCESS, icon: "📅" },
  ];

  const recent = (messages || []).slice(0, 6);

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5, marginBottom: 4 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {customer?.business_name || "there"} 👋
        </h1>
        <p style={{ color: TEXT2, fontSize: 13 }}>Here's what's happening with your WhatsApp automation.</p>
      </div>

      <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}>📱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: TEXT1, fontSize: 13, fontWeight: 600 }}>WhatsApp Connected</span>
          <span style={{ color: TEXT2, fontSize: 13 }}> · Receiving messages</span>
        </div>
        <div className="badge badge-green">● Live</div>
      </div>

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="card card-hover" style={{ padding: "18px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: TEXT1, letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: TEXT1 }}>Recent Messages</span>
        </div>
        {mL ? <Loader /> : !recent.length ? <Empty msg="No messages yet. Send a test message to your WhatsApp number." /> :
          recent.map((m, i) => (
            <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 2fr auto", gap: 12 }}>
              <div style={{ fontSize: 12, color: TEXT1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from_number || m.to_number}</div>
              <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
              <div className={`badge ${m.direction === "inbound" ? "badge-blue" : "badge-green"}`}>{m.direction === "inbound" ? "In" : "Out"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── BROADCASTS ─────────────────────────────────────────────────────────────
function Broadcasts() {
  const { data, loading, refetch } = useAPI("/broadcasts/scheduled");
  const [form, setForm] = useState({ message: "", phone: "" });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const sendNow = async () => {
    if (!form.message || !form.phone) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/broadcasts/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: [{ name: "Contact", phone_number: form.phone }], message: form.message }) });
      const data = await res.json();
      alert(`Sent: ${data.sent} · Failed: ${data.failed}`);
      setForm({ message: "", phone: "" });
    } catch (e) { alert("Error: " + e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT1, marginBottom: 4, letterSpacing: -0.5 }}>Broadcasts</h2>
      <p style={{ color: TEXT2, fontSize: 13, marginBottom: 20 }}>Send bulk messages to your contact list</p>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: TEXT1, marginBottom: 14 }}>Send a Message</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" placeholder="+260971234567" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="textarea" placeholder="Hi {{name}}, your message here..." value={form.message} onChange={e => set("message", e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={sendNow} disabled={sending} style={{ width: "auto", alignSelf: "flex-start", padding: "10px 20px" }}>
            <I n="send" s={13} c="white" /> {sending ? "Sending..." : "Send Now"}
          </button>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, color: TEXT1, marginBottom: 12 }}>Scheduled Broadcasts</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <Loader /> : !(data?.length) ? <Empty msg="No scheduled broadcasts yet" /> :
          data.map((b, i) => (
            <div key={i} className="table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{b.broadcast_name}</div>
              <div style={{ fontSize: 12, color: TEXT2 }}>{new Date(b.scheduled_at).toLocaleDateString()}</div>
              <div className={`badge ${b.status === "completed" ? "badge-green" : b.status === "pending" ? "badge-yellow" : "badge-blue"}`} style={{ textTransform: "capitalize" }}>{b.status}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── CONTACTS ───────────────────────────────────────────────────────────────
function Contacts() {
  const { data, loading, refetch } = useAPI("/contacts");
  const [search, setSearch] = useState("");
  const filtered = (data || []).filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone_number || "").includes(search));

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Contacts</h2>
          <p style={{ color: TEXT2, fontSize: 13 }}>{loading ? "Loading..." : `${data?.length || 0} contacts`}</p>
        </div>
        <button className="btn btn-ghost" style={{ width: "auto", padding: "8px 14px" }}><I n="upload" s={13} c={TEXT2} /> Import CSV</button>
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><I n="search" s={14} c={TEXT2} /></div>
        <input className="input" placeholder="Search contacts..." style={{ paddingLeft: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No contacts found" /> :
          filtered.map((c, i) => (
            <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 1fr auto", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {(c.name || "?").charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{c.name || "Unknown"}</span>
              </div>
              <div style={{ fontSize: 12, color: TEXT2 }}>{c.phone_number}</div>
              <div className={`badge ${c.tag === "VIP" ? "badge-yellow" : "badge-blue"}`}>{c.tag || "Contact"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── MESSAGE LOG ────────────────────────────────────────────────────────────
function MessageLog() {
  const { data, loading, refetch } = useAPI("/messages");
  const [search, setSearch] = useState("");
  const filtered = (data || []).filter(m => (m.message_body || "").toLowerCase().includes(search.toLowerCase()) || (m.from_number || m.to_number || "").includes(search));

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Message Log</h2>
          <p style={{ color: TEXT2, fontSize: 13 }}>{loading ? "Loading..." : `${data?.length || 0} messages`}</p>
        </div>
        <button className="btn btn-ghost" style={{ width: "auto", padding: "8px 14px" }} onClick={refetch}><I n="refresh" s={13} c={TEXT2} /></button>
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><I n="search" s={14} c={TEXT2} /></div>
        <input className="input" placeholder="Search messages..." style={{ paddingLeft: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No messages yet" /> :
          filtered.slice(0, 50).map((m, i) => (
            <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 2fr auto auto", gap: 10 }}>
              <div style={{ fontSize: 12, color: TEXT1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from_number || m.to_number}</div>
              <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
              <div className={`badge ${m.direction === "inbound" ? "badge-blue" : "badge-green"}`}>{m.direction === "inbound" ? "In" : "Out"}</div>
              <div className="table-hide-mobile" style={{ fontSize: 11, color: TEXT2 }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── AUTOMATIONS ────────────────────────────────────────────────────────────
function Automations() {
  const { data, loading, refetch } = useAPI("/automations");
  const [form, setForm] = useState({ keyword: "", reply: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = async () => {
    if (!form.keyword || !form.reply) return;
    setSaving(true);
    try {
      await fetch(`${API}/automations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_type: "keyword", trigger_value: form.keyword.toUpperCase().trim(), message_template: form.reply }) });
      setForm({ keyword: "", reply: "" });
      refetch();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id, current) => {
    await fetch(`${API}/automations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !current }) });
    refetch();
  };

  const keywords = (data || []).filter(a => a.trigger_type === "keyword");

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT1, marginBottom: 4, letterSpacing: -0.5 }}>Automations</h2>
      <p style={{ color: TEXT2, fontSize: 13, marginBottom: 20 }}>Keywords that trigger automatic replies</p>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: TEXT1, marginBottom: 12 }}>Add Keyword</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="input" placeholder="Keyword (e.g. PRICING)" value={form.keyword} onChange={e => set("keyword", e.target.value)} />
          <textarea className="textarea" placeholder="Auto-reply message..." value={form.reply} onChange={e => set("reply", e.target.value)} style={{ minHeight: 70 }} />
          <button className="btn btn-primary" onClick={add} disabled={saving} style={{ width: "auto", alignSelf: "flex-start", padding: "9px 18px" }}>
            <I n="plus" s={13} c="white" /> {saving ? "Adding..." : "Add Keyword"}
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <Loader /> : !keywords.length ? <Empty msg="No keywords yet" /> :
          keywords.map((k, i) => (
            <div key={i} className="table-row" style={{ gridTemplateColumns: "auto 1fr auto auto", gap: 12 }}>
              <div style={{ background: "rgba(91,91,214,0.1)", border: "1px solid rgba(91,91,214,0.2)", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, color: "#A5A5FF", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{k.trigger_value}</div>
              <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.message_template}</div>
              <div className={`badge ${k.is_active ? "badge-green" : "badge-red"}`}>{k.is_active ? "Active" : "Off"}</div>
              <button className="btn btn-ghost" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => toggle(k.id, k.is_active)}>{k.is_active ? "Pause" : "Enable"}</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────
function Settings({ user, customer }) {
  return (
    <div className="page-content" style={{ padding: 24, maxWidth: 560 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: TEXT1, marginBottom: 4, letterSpacing: -0.5 }}>Account & Billing</h2>
      <p style={{ color: TEXT2, fontSize: 13, marginBottom: 20 }}>Manage your ZedPing subscription</p>

      <div style={{ background: "rgba(91,91,214,0.06)", border: "1px solid rgba(91,91,214,0.2)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT1, marginBottom: 3, textTransform: "capitalize" }}>{customer?.subscription_plan || "Starter"} Plan</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>
              {customer?.subscription_status === "trial" ? `Trial ends ${customer?.trial_ends_at ? new Date(customer.trial_ends_at).toLocaleDateString() : "soon"}` : "Active subscription"}
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: "auto", padding: "8px 14px", fontSize: 12 }}>Upgrade →</button>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: TEXT1, marginBottom: 14 }}>Business Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Business Name", customer?.business_name || ""], ["Email", user?.email || ""], ["Phone", customer?.phone || ""]].map(([label, val]) => (
            <div key={label}>
              <label className="label">{label}</label>
              <input className="input" defaultValue={val} readOnly style={{ opacity: 0.7 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────────────────────
export default function App() {
  const [authView, setAuthView] = useState("login");
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const { data: cust } = await supabase.from("customers").select("*").eq("auth_user_id", session.user.id).single();
        setCustomer(cust || {});
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: cust } = await supabase.from("customers").select("*").eq("auth_user_id", session.user.id).single();
        setCustomer(cust || {});
      } else {
        setUser(null);
        setCustomer(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = (u, c) => { setUser(u); setCustomer(c); };
  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setCustomer(null); setActive("overview"); };

  const pages = {
    overview:    { title: "Overview",        component: <Overview customer={customer} /> },
    broadcasts:  { title: "Broadcasts",      component: <Broadcasts /> },
    contacts:    { title: "Contacts",        component: <Contacts /> },
    messages:    { title: "Message Log",     component: <MessageLog /> },
    automations: { title: "Automations",     component: <Automations /> },
    settings:    { title: "Account",         component: <Settings user={user} customer={customer} /> },
  };

  const current = pages[active];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{css}</style>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!user) return (
    <>
      <style>{css}</style>
      {authView === "signup"
        ? <SignUp onSwitch={() => setAuthView("login")} onAuth={handleAuth} />
        : <Login onSwitch={() => setAuthView("signup")} onAuth={handleAuth} />
      }
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} user={user} customer={customer} onLogout={handleLogout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-content">
          <MobileTopbar title={current.title} onMenuOpen={() => setSidebarOpen(true)} />
          <Topbar title={current.title} user={user} customer={customer} />
          <div style={{ flex: 1, overflowY: "auto" }}>
            {current.component}
          </div>
        </div>
      </div>
    </>
  );
}
