// @ts-nocheck
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zzhqhgeyxbdqdkacrviq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHFoZ2V5eGJkcWRrYWNydmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMwNDEsImV4cCI6MjA5NDU3OTA0MX0.C4xDheJF3qOB7L3LWZKryNgE4-eMc05kJi4qwDhp-sI";
const API = "https://zedping-backend-production.up.railway.app";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

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

  .editorial { font-family: 'Cormorant Garant', serif; line-height: 1; }
  .mono { font-family: 'DM Mono', monospace; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.25s; border: none; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; }
  .btn-gold { background: var(--gold2); color: var(--ink); padding: 10px 20px; }
  .btn-gold:hover { background: var(--cream); transform: translateY(-1px); }
  .btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-wire { background: transparent; color: var(--cream2); border: 1px solid var(--wire); padding: 9px 18px; }
  .btn-wire:hover { border-color: var(--gold); color: var(--gold2); }
  .btn-danger { background: transparent; color: #FCA5A5; border: 1px solid rgba(239,68,68,0.2); padding: 9px 18px; }

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
  .badge-green { background: rgba(34,197,94,0.06); color: #86EFAC; border: 1px solid rgba(34,197,94,0.15); }
  .badge-blue { background: rgba(59,130,246,0.06); color: #93C5FD; border: 1px solid rgba(59,130,246,0.15); }
  .badge-red { background: rgba(239,68,68,0.06); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.15); }
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

  ::-webkit-scrollbar { width: 3px; }
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
      <div style={{ position: "relative" }}>
        <div style={{ width: sz, height: sz, background: "var(--ink)", border: "1px solid var(--wire2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="editorial" style={{ color: "var(--cream)", fontSize: fs * 1.1, fontWeight: 600, lineHeight: 1 }}>Z</span>
        </div>
        <div style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, background: "var(--gold2)", borderRadius: "50%", boxShadow: "0 0 6px rgba(212,168,67,0.6)" }} />
      </div>
      <span style={{ fontFamily: "Cormorant Garant, serif", fontWeight: 600, fontSize: fs, color: "var(--cream)", letterSpacing: 0.5 }}>
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
      const r = await fetch(`${API}${endpoint}`);
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
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      {/* Subtle warm glow */}
      <div style={{ position: "absolute", top: "10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,146,42,0.05) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,58,42,0.12) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
      {/* Vertical lines */}
      {[25,50,75].map(x => <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 1, background: "rgba(255,255,255,0.015)", pointerEvents: "none" }} />)}
      <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}><Logo size="lg" /></div>
        {children}
      </div>
    </div>
  );
}

// ── SIGNUP ────────────────────────────────────────────────────────────────────
function SignUp({ onSwitch, onAuth }) {
  const [f, setF] = useState({ name:"", business_name:"", email:"", phone:"", password:"" });
  const [plan, setPlan] = useState("business");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);
  const set = (k,v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name||!f.business_name||!f.email||!f.password) { setErr("Please fill in all required fields."); return; }
    if (f.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name, business_name: f.business_name, phone: f.phone, subscription_plan: plan } } });
      if (error) throw error;
      if (data.user) {
        await supabase.from("customers").insert({ auth_user_id: data.user.id, business_name: f.business_name, email: f.email, phone: f.phone, subscription_plan: plan, subscription_status: "trial" });
        onAuth(data.user, { business_name: f.business_name, name: f.name, subscription_plan: plan });
      }
    } catch (e) { setErr(e.message || "Sign up failed."); }
    finally { setLoading(false); }
  };

  const plans = [
    { id: "starter", label: "Starter", price: "K650" },
    { id: "business", label: "Business", price: "K1,500", popular: true },
    { id: "pro", label: "Pro", price: "K2,500" },
  ];

  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Create Account</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 6, letterSpacing: -0.5, fontWeight: 600 }}>Get started free.</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>Explore the full dashboard. Pay when you're ready to go live.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label className="label">Your Name *</label><input className="input" placeholder="Veronica" value={f.name} onChange={e=>set("name",e.target.value)} /></div>
            <div><label className="label">Business Name *</label><input className="input" placeholder="My Business" value={f.business_name} onChange={e=>set("business_name",e.target.value)} /></div>
          </div>
          <div><label className="label">Email *</label><input className="input" type="email" placeholder="you@business.com" value={f.email} onChange={e=>set("email",e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" placeholder="+260971234567" value={f.phone} onChange={e=>set("phone",e.target.value)} /></div>
          <div>
            <label className="label">Password *</label>
            <div style={{ position: "relative" }}>
              <input className="input" type={showP?"text":"password"} placeholder="Min 6 characters" value={f.password} onChange={e=>set("password",e.target.value)} style={{ paddingRight: 44 }} />
              <button onClick={()=>setShowP(s=>!s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--mist)" }}>
                <Ic n={showP?"eyeoff":"eye"} s={14} c="var(--mist)" />
              </button>
            </div>
          </div>
          <div>
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
          </div>
          {err && <div className="mono" style={{ color: "#FCA5A5", fontSize: 11, letterSpacing: 0.5 }}>{err}</div>}
          <button className="btn btn-gold" onClick={submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11, marginTop: 4 }}>
            {loading ? <div className="spin" /> : "Start Exploring Free →"}
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
function Login({ onSwitch, onAuth }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showP, setShowP] = useState(false);
  const [reset, setReset] = useState(false);
  const set = (k,v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.email||!f.password) { setErr("Please enter your email and password."); return; }
    setLoading(true); setErr("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) throw error;
      const { data: cust } = await supabase.from("customers").select("*").eq("auth_user_id", data.user.id).single();
      onAuth(data.user, cust || {});
    } catch (e) { setErr(e.message === "Invalid login credentials" ? "Incorrect email or password." : e.message); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    if (!f.email) { setErr("Please enter your email first."); return; }
    await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin });
    setReset(true);
  };

  return (
    <AuthWrap>
      <div className="auth-card">
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Welcome Back</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 6, letterSpacing: -0.5, fontWeight: 600 }}>Sign in.</h2>
        <p style={{ color: "var(--mist)", fontSize: 14, marginBottom: 32 }}>Access your ZedPing dashboard.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label className="label">Email</label><input className="input" type="email" placeholder="you@business.com" value={f.email} onChange={e=>set("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <label className="label" style={{ margin: 0 }}>Password</label>
              <span className="mono" style={{ fontSize: 9, color: "var(--gold2)", cursor: "pointer", letterSpacing: 1 }} onClick={sendReset}>Forgot?</span>
            </div>
            <div style={{ position: "relative" }}>
              <input className="input" type={showP?"text":"password"} placeholder="Your password" value={f.password} onChange={e=>set("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ paddingRight: 44 }} />
              <button onClick={()=>setShowP(s=>!s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                <Ic n={showP?"eyeoff":"eye"} s={14} c="var(--mist)" />
              </button>
            </div>
          </div>
          {err && <div className="mono" style={{ color: "#FCA5A5", fontSize: 11 }}>{err}</div>}
          {reset && <div className="mono" style={{ color: "#86EFAC", fontSize: 11 }}>Reset email sent. Check your inbox.</div>}
          <button className="btn btn-gold" onClick={submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11 }}>
            {loading ? <div className="spin" /> : "Sign In →"}
          </button>
        </div>
        <p style={{ textAlign: "center", color: "var(--mist)", fontSize: 13, marginTop: 20 }}>
          Don't have an account?{" "}
          <span style={{ color: "var(--gold2)", cursor: "pointer", fontWeight: 500 }} onClick={onSwitch}>Sign up free</span>
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
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, marginBottom: 6 }}>Security</div>
        <h2 className="editorial" style={{ fontSize: 38, color: "var(--cream)", marginBottom: 28, fontWeight: 600 }}>New password.</h2>
        {ok ? <div className="mono" style={{ color: "#86EFAC", fontSize: 11, textAlign: "center", padding: "24px 0" }}>Password updated. Redirecting...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label className="label">New Password</label><input className="input" type="password" placeholder="Min 6 characters" value={pw} onChange={e=>setPw(e.target.value)} /></div>
            <div><label className="label">Confirm Password</label><input className="input" type="password" placeholder="Repeat password" value={cpw} onChange={e=>setCpw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
            {err && <div className="mono" style={{ color: "#FCA5A5", fontSize: 11 }}>{err}</div>}
            <button className="btn btn-gold" onClick={submit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 11 }}>
              {loading ? <div className="spin" /> : "Set New Password →"}
            </button>
          </div>
        )}
      </div>
    </AuthWrap>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, customer, onLogout, open, onClose }) {
  const links = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "broadcasts", label: "Broadcasts", icon: "broadcast" },
    { id: "contacts", label: "Contacts", icon: "contacts" },
    { id: "messages", label: "Message Log", icon: "messages" },
    { id: "automations", label: "Automations", icon: "auto" },
    { id: "settings", label: "Account", icon: "settings" },
  ];
  const initial = (customer?.business_name || user?.email || "Z").charAt(0).toUpperCase();

  return (
    <>
      <div className={`overlay ${open?"show":""}`} onClick={onClose} />
      <div className={`sidebar ${open?"open":""}`}>
        {/* Logo */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--wire)", position: "relative" }}>
          <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
          <Logo size="sm" />
        </div>

        {/* Business pill */}
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

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          <div className="mono" style={{ fontSize: 8, color: "var(--mist)", letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px 10px", opacity: 0.5 }}>Navigation</div>
          {links.map(l => (
            <button key={l.id} className={`slink ${active===l.id?"active":""}`} onClick={()=>{ setActive(l.id); onClose(); }}>
              <span style={{ color: active===l.id ? "var(--gold2)" : "var(--mist)", flexShrink: 0 }}><Ic n={l.icon} s={13} c="currentColor" /></span>
              {l.label}
            </button>
          ))}
        </nav>

        {/* Usage */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--wire)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 8, color: "var(--mist)", letterSpacing: 1, textTransform: "uppercase" }}>Messages</span>
            <span className="mono" style={{ fontSize: 8, color: "var(--gold2)" }}>3,000/mo</span>
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: "28%" }} /></div>
        </div>

        {/* Logout */}
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
function Topbar({ title, user, customer }) {
  const initial = (customer?.business_name || user?.email || "Z").charAt(0).toUpperCase();
  return (
    <div className="desk-bar" style={{ height: 56, alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: "1px solid var(--wire)", background: "rgba(9,9,9,0.9)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 1, height: 16, background: "var(--gold)", opacity: 0.6 }} />
        <span className="mono" style={{ fontSize: 10, color: "var(--cream2)", letterSpacing: 2, textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cream)" }}>{customer?.business_name || "My Business"}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--mist)" }}>{user?.email}</div>
        </div>
        <div style={{ width: 32, height: 32, background: "var(--green)", border: "1px solid var(--wire2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="editorial" style={{ color: "var(--gold2)", fontSize: 15, fontWeight: 600 }}>{initial}</span>
        </div>
      </div>
    </div>
  );
}

function MobTopbar({ onMenu, onLogout }) {
  return (
    <div className="mob-bar">
      <button onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cream)", padding: 4 }}><Ic n="menu" s={20} c="var(--cream)" /></button>
      <Logo size="sm" />
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
function Overview({ customer, user }) {
  const cid = customer?.id ? "?customer_id=" + customer.id : "";
  const { data: msgs, loading: mL } = useAPI(`/messages${cid}`);
  const { data: contacts, loading: cL } = useAPI(`/contacts${cid}`);
  const { data: autos } = useAPI(`/automations${cid}`);
  const todayOut = (msgs||[]).filter(m => new Date(m.created_at).toDateString()===new Date().toDateString()&&m.direction==="outbound").length;
  const h = new Date().getHours();
  const greet = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  const stats = [
    { label: "Sent Today", value: mL ? "—" : todayOut, sub: "Outbound messages", color: "var(--gold2)" },
    { label: "Contacts", value: cL ? "—" : (contacts?.length||0), sub: "In your list", color: "var(--cream2)" },
    { label: "Active Keywords", value: (autos||[]).filter(a=>a.is_active&&a.trigger_type==="keyword").length, sub: "Automations live", color: "var(--gold2)" },
    { label: "Plan", value: (customer?.subscription_plan||"Starter").charAt(0).toUpperCase()+(customer?.subscription_plan||"starter").slice(1), sub: customer?.subscription_status||"trial", color: "var(--cream2)" },
  ];

  return (
    <div className="pad" style={{ padding: 28 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 20, height: 1, background: "var(--gold)", opacity: 0.6 }} />
          <span className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase" }}>{greet}</span>
        </div>
        <h1 className="editorial" style={{ fontSize: 36, color: "var(--cream)", fontWeight: 600, marginBottom: 4, letterSpacing: -0.5 }}>{customer?.business_name || user?.email?.split("@")[0] || "Welcome"}</h1>
        <p style={{ color: "var(--mist)", fontSize: 14 }}>Your WhatsApp automation dashboard.</p>
      </div>

      {/* Activation banner */}
      <div style={{ background: "rgba(26,58,42,0.4)", border: "1px solid var(--wire2)", padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
        <span style={{ fontSize: 18 }}>📱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--cream)", fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Activate your WhatsApp number</div>
          <div style={{ color: "var(--mist)", fontSize: 13 }}>You're exploring ZedPing free. Pay to connect your WhatsApp number and go live.</div>
        </div>
        <button className="btn btn-gold" style={{ flexShrink: 0, padding: "9px 18px", fontSize: 10 }}>Pay to Activate →</button>
      </div>

      {/* Stats */}
      <div className="stat-g" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {stats.map((s,i) => (
          <div key={i} style={{ background: "var(--panel)", border: "1px solid var(--wire)", padding: "20px 18px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.3 }} />
            <div className="editorial" style={{ fontSize: 40, color: "var(--cream)", lineHeight: 1, marginBottom: 8, fontWeight: 600 }}>{s.value}</div>
            <div className="mono" style={{ fontSize: 9, color: s.color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "var(--mist)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent messages */}
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
  const cid = customer?.id ? "?customer_id=" + customer.id : "";
  const { data, loading, refetch } = useAPI(`/broadcasts/scheduled${cid}`);
  const [form, setForm] = useState({ message: "", phone: "" });
  const [sending, setSending] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const send = async () => {
    if (!form.message||!form.phone) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/broadcasts/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contacts:[{name:"Contact",phone_number:form.phone}],message:form.message})});
      const d = await r.json();
      alert(`Sent: ${d.sent} · Failed: ${d.failed}`);
      setForm({message:"",phone:""});
    } catch(e) { alert("Error: "+e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="WhatsApp" title="Broadcasts." sub="Send messages to your contact list" />
      <div className="card" style={{ padding: 24, marginBottom: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.4 }} />
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Send Message</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label className="label">Phone Number</label><input className="input" placeholder="+260971234567" value={form.phone} onChange={e=>set("phone",e.target.value)} /></div>
          <div><label className="label">Message</label><textarea className="textarea" placeholder="Your message here..." value={form.message} onChange={e=>set("message",e.target.value)} /></div>
          <button className="btn btn-gold" onClick={send} disabled={sending} style={{ alignSelf:"flex-start", padding:"10px 22px" }}>
            <Ic n="send" s={12} c="var(--ink)" />{sending?"Sending...":"Send Now"}
          </button>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 9, color: "var(--mist)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Scheduled Broadcasts</div>
      <div className="card">
        {loading ? <Loader /> : !(data?.length) ? <Empty msg="No scheduled broadcasts" /> :
          data.map((b,i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)" }}>{b.broadcast_name}</div>
              <div style={{ fontSize: 12, color: "var(--mist)" }}>{new Date(b.scheduled_at).toLocaleDateString()}</div>
              <div className={`badge ${b.status==="completed"?"badge-green":b.status==="pending"?"badge-gold":"badge-blue"}`}>{b.status?.toUpperCase()}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
function Contacts({ customer }) {
  const cid = customer?.id ? "?customer_id=" + customer.id : "";
  const { data, loading } = useAPI(`/contacts${cid}`);
  const [search, setSearch] = useState("");
  const filtered = (data||[]).filter(c=>(c.name||"").toLowerCase().includes(search.toLowerCase())||(c.phone_number||"").includes(search));

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="Database" title="Contacts." sub={loading ? "Loading..." : `${data?.length||0} contacts`}
        action={<button className="btn btn-wire"><Ic n="upload" s={12} c="var(--mist)" />Import CSV</button>}
      />
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Ic n="search" s={13} c="var(--mist)" /></div>
        <input className="input" placeholder="Search contacts..." style={{ paddingLeft: 36 }} value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="row th" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12 }}>
          {["Name","Phone","Tag","Added"].map(h=><div key={h}>{h}</div>)}
        </div>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No contacts found" /> :
          filtered.map((c,i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, background: "var(--green)", border: "1px solid var(--wire2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="editorial" style={{ color: "var(--gold2)", fontSize: 13, fontWeight: 600 }}>{(c.name||"?").charAt(0).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)" }}>{c.name||"Unknown"}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--mist)" }}>{c.phone_number}</div>
              <div className={`badge ${c.tag==="VIP"?"badge-gold":"badge-cream"}`}>{c.tag||"Contact"}</div>
              <div style={{ fontSize: 11, color: "var(--mist)" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── MESSAGE LOG ───────────────────────────────────────────────────────────────
function MessageLog({ customer }) {
  const cid = customer?.id ? "?customer_id=" + customer.id : "";
  const { data, loading, refetch } = useAPI(`/messages${cid}`);
  const [search, setSearch] = useState("");
  const filtered = (data||[]).filter(m=>(m.message_body||"").toLowerCase().includes(search.toLowerCase())||(m.from_number||m.to_number||"").includes(search));

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="Log" title="Messages." sub={loading?"Loading...":`${data?.length||0} messages`}
        action={<button className="btn btn-wire" onClick={refetch}><Ic n="refresh" s={12} c="var(--mist)" /></button>}
      />
      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Ic n="search" s={13} c="var(--mist)" /></div>
        <input className="input" placeholder="Search messages..." style={{ paddingLeft: 36 }} value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="row th" style={{ gridTemplateColumns: "1.2fr 3fr 100px 80px", gap: 12 }}>
          {["Contact","Message","Direction","Time"].map(h=><div key={h}>{h}</div>)}
        </div>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No messages yet" /> :
          filtered.slice(0,50).map((m,i) => (
            <div key={i} className="row" style={{ gridTemplateColumns: "1.2fr 3fr 100px 80px", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from_number||m.to_number}</div>
              <div style={{ fontSize: 12, color: "var(--mist)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
              <div className={`badge ${m.direction==="inbound"?"badge-blue":"badge-green"}`}>{m.direction==="inbound"?"Inbound":"Outbound"}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--mist)" }}>{m.created_at?new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── AUTOMATIONS ───────────────────────────────────────────────────────────────
function Automations({ customer }) {
  const cid = customer?.id ? "?customer_id=" + customer.id : "";
  const { data, loading, refetch } = useAPI(`/automations${cid}`);
  const [form, setForm] = useState({ keyword: "", reply: "" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const add = async () => {
    if (!form.keyword||!form.reply) return;
    setSaving(true);
    try {
      await fetch(`${API}/automations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger_type:"keyword",trigger_value:form.keyword.toUpperCase().trim(),message_template:form.reply})});
      setForm({keyword:"",reply:""});
      refetch();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id,cur) => {
    await fetch(`${API}/automations/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:!cur})});
    refetch();
  };

  const keywords = (data||[]).filter(a=>a.trigger_type==="keyword");

  return (
    <div className="pad" style={{ padding: 28 }}>
      <PageHead label="Engine" title="Automations." sub="Keyword triggers and auto-replies" />
      <div className="card" style={{ padding: 22, marginBottom: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold2), transparent)", opacity: 0.3 }} />
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Add Keyword</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "flex-end" }}>
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
              <div className={`badge ${k.is_active?"badge-green":"badge-red"}`}>{k.is_active?"Active":"Off"}</div>
              <button className="btn btn-wire" style={{ fontSize: 9, padding: "4px 10px" }} onClick={()=>toggle(k.id,k.is_active)}>{k.is_active?"Pause":"Enable"}</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings({ user, customer }) {
  return (
    <div className="pad" style={{ padding: 28, maxWidth: 580 }}>
      <PageHead label="Config" title="Account." sub="Manage your ZedPing subscription" />
      <div className="card-gold" style={{ padding: 24, marginBottom: 16, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.5 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Current Plan</div>
            <div className="editorial" style={{ fontSize: 28, color: "var(--cream)", fontWeight: 600, letterSpacing: -0.3 }}>{(customer?.subscription_plan||"Starter").charAt(0).toUpperCase()+(customer?.subscription_plan||"starter").slice(1)}</div>
            <div style={{ fontSize: 12, color: "var(--mist)", marginTop: 3 }}>{customer?.subscription_status==="trial"?"Free trial":"Active subscription"}</div>
          </div>
          <button className="btn btn-gold" style={{ padding: "9px 18px", fontSize: 10 }}>Upgrade →</button>
        </div>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>Business Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["Business Name", customer?.business_name||""], ["Email Address", user?.email||""], ["Phone Number", customer?.phone||""]].map(([label,val]) => (
            <div key={label}>
              <label className="label">{label}</label>
              <input className="input" defaultValue={val} readOnly style={{ opacity: 0.5 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState(window.location.search.includes("signup") ? "signup" : "login");
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [active, setActive] = useState("overview");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reset, setReset] = useState(() => window.location.hash.includes("type=recovery"));

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const { data: c } = await supabase.from("customers").select("*").eq("auth_user_id", session.user.id).single();
        setCustomer(c||{});
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event==="PASSWORD_RECOVERY") { setReset(true); setUser(null); return; }
      if (session?.user) {
        setUser(session.user);
        const { data: c } = await supabase.from("customers").select("*").eq("auth_user_id", session.user.id).single();
        setCustomer(c||{});
      } else { setUser(null); setCustomer(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onAuth = (u, c) => { setUser(u); setCustomer(c); };
  const onLogout = async () => { await supabase.auth.signOut(); setUser(null); setCustomer(null); setActive("overview"); };

  const pages = {
    overview:    { title: "Overview",     comp: <Overview customer={customer} user={user} /> },
    broadcasts:  { title: "Broadcasts",   comp: <Broadcasts customer={customer} /> },
    contacts:    { title: "Contacts",     comp: <Contacts customer={customer} /> },
    messages:    { title: "Message Log",  comp: <MessageLog customer={customer} /> },
    automations: { title: "Automations",  comp: <Automations customer={customer} /> },
    settings:    { title: "Account",      comp: <Settings user={user} customer={customer} /> },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{css}</style>
      <div className="spin" style={{ width: 24, height: 24 }} />
      <div className="mono" style={{ color: "var(--gold2)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>Loading</div>
    </div>
  );

  if (reset) return <><style>{css}</style><ResetPass onDone={()=>setReset(false)} /></>;
  if (!user) return (
    <>
      <style>{css}</style>
      {view==="signup" ? <SignUp onSwitch={()=>setView("login")} onAuth={onAuth} /> : <Login onSwitch={()=>setView("signup")} onAuth={onAuth} />}
    </>
  );

  const cur = pages[active];

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} user={user} customer={customer} onLogout={onLogout} open={open} onClose={()=>setOpen(false)} />
        <div className="main">
          <MobTopbar onMenu={()=>setOpen(true)} onLogout={onLogout} />
          <Topbar title={cur.title} user={user} customer={customer} />
          <div style={{ flex: 1, overflowY: "auto" }}>{cur.comp}</div>
        </div>
      </div>
    </>
  );
}
