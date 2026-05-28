import { useState, useEffect } from "react";

const API = "https://zedping-backend-production.up.railway.app";

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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${BG}; color: ${TEXT1}; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  .sidebar-link { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 500; color: ${TEXT2}; cursor: pointer; transition: all 0.15s; border: none; background: transparent; width: 100%; text-align: left; }
  .sidebar-link:hover { background: rgba(255,255,255,0.05); color: ${TEXT1}; }
  .sidebar-link.active { background: rgba(91,91,214,0.15); color: ${TEXT1}; border: 1px solid rgba(91,91,214,0.2); }
  .stat-card { background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 22px 24px; transition: border-color 0.2s; }
  .stat-card:hover { border-color: rgba(91,91,214,0.25); }
  .btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.18s; border: none; font-family: 'Plus Jakarta Sans', sans-serif; }
  .btn-primary { background: ${INDIGO}; color: white; }
  .btn-primary:hover { background: #4A4ABF; box-shadow: 0 4px 16px rgba(91,91,214,0.3); }
  .btn-ghost { background: rgba(255,255,255,0.06); color: ${TEXT1}; border: 1px solid ${BORDER}; }
  .btn-ghost:hover { background: rgba(255,255,255,0.1); }
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; }
  .badge-green { background: rgba(34,197,94,0.1); color: #86EFAC; border: 1px solid rgba(34,197,94,0.2); }
  .badge-yellow { background: rgba(245,158,11,0.1); color: #FCD34D; border: 1px solid rgba(245,158,11,0.2); }
  .badge-blue { background: rgba(91,91,214,0.1); color: #A5A5FF; border: 1px solid rgba(91,91,214,0.2); }
  .badge-red { background: rgba(239,68,68,0.1); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.2); }
  .table-row { display: grid; padding: 14px 20px; border-bottom: 1px solid ${BORDER}; font-size: 13px; align-items: center; transition: background 0.15s; }
  .table-row:hover { background: rgba(255,255,255,0.02); }
  .input { background: ${SURFACE2}; border: 1px solid ${BORDER}; border-radius: 9px; padding: 10px 14px; font-size: 14px; color: ${TEXT1}; outline: none; font-family: 'Plus Jakarta Sans', sans-serif; transition: border-color 0.2s; width: 100%; }
  .input:focus { border-color: rgba(91,91,214,0.5); }
  .input::placeholder { color: ${TEXT2}; }
  .textarea { background: ${SURFACE2}; border: 1px solid ${BORDER}; border-radius: 9px; padding: 12px 14px; font-size: 14px; color: ${TEXT1}; outline: none; font-family: 'Plus Jakarta Sans', sans-serif; transition: border-color 0.2s; width: 100%; resize: vertical; min-height: 100px; }
  .textarea:focus { border-color: rgba(91,91,214,0.5); }
  .tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; background: transparent; color: ${TEXT2}; font-family: 'Plus Jakarta Sans', sans-serif; }
  .tab.active { background: rgba(91,91,214,0.15); color: ${TEXT1}; }
  .tab:hover:not(.active) { color: ${TEXT1}; background: rgba(255,255,255,0.04); }
  .progress-bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, ${INDIGO}, ${CYAN}); transition: width 0.6s ease; }
  .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.1); border-top-color: ${INDIGO}; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty { text-align: center; padding: 48px 24px; color: ${TEXT2}; font-size: 14px; }
`;

// ── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const icons = {
    home: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    broadcast: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
    contacts: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    templates: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    messages: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    automation: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
    send: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  };
  return icons[name] || null;
};

// ── API HOOK ─────────────────────────────────────────────────────────────────
function useAPI(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}${endpoint}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, deps);
  return { data, loading, error, refetch: fetch_ };
}

function Loader() {
  return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" /></div>;
}

function Empty({ msg = "No data yet" }) {
  return <div className="empty">{msg}</div>;
}

// ── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive }) {
  const links = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "broadcasts", label: "Broadcasts", icon: "broadcast" },
    { id: "contacts", label: "Contacts", icon: "contacts" },
    { id: "templates", label: "Templates", icon: "templates" },
    { id: "messages", label: "Message Log", icon: "messages" },
    { id: "automations", label: "Automations", icon: "automation" },
  ];

  return (
    <div style={{ width: 220, background: SURFACE, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <div style={{ padding: "20px 18px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, background: INDIGO, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 17 }}>Z</span>
            <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: CYAN, boxShadow: `0 0 6px ${CYAN}` }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: TEXT1 }}>Zed<span style={{ color: CYAN }}>Ping</span></span>
        </div>
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>S</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1 }}>Sunrise Medical</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: SUCCESS, display: "inline-block", boxShadow: `0 0 5px ${SUCCESS}` }} />
              <span style={{ fontSize: 10, color: TEXT2 }}>Business Plan</span>
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 8px 10px", opacity: 0.6 }}>Main</div>
        {links.map(l => (
          <button key={l.id} className={`sidebar-link ${active === l.id ? "active" : ""}`} onClick={() => setActive(l.id)}>
            <span style={{ color: active === l.id ? INDIGO : TEXT2 }}><Icon name={l.icon} size={15} color="currentColor" /></span>
            <span style={{ flex: 1 }}>{l.label}</span>
          </button>
        ))}
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, letterSpacing: 1.2, textTransform: "uppercase", padding: "14px 8px 10px", opacity: 0.6 }}>Settings</div>
        <button className={`sidebar-link ${active === "settings" ? "active" : ""}`} onClick={() => setActive("settings")}>
          <span style={{ color: active === "settings" ? INDIGO : TEXT2 }}><Icon name="settings" size={15} color="currentColor" /></span>
          Account & Billing
        </button>
      </nav>

      <div style={{ padding: "14px 16px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: TEXT2 }}>Messages</span>
          <span style={{ fontSize: 11, color: TEXT2 }}>Business plan</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "62%" }} />
        </div>
      </div>
    </div>
  );
}

// ── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ title, subtitle, onRefresh }) {
  return (
    <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${BORDER}`, background: "rgba(18,26,43,0.9)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT1, letterSpacing: -0.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onRefresh && (
          <button className="btn btn-ghost" style={{ padding: "7px 10px" }} onClick={onRefresh}>
            <Icon name="refresh" size={14} color={TEXT2} />
          </button>
        )}
        <button className="btn btn-ghost" style={{ padding: "7px 10px" }}>
          <Icon name="bell" size={15} color={TEXT2} />
        </button>
        <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>V</div>
      </div>
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview({ setActive }) {
  const { data: messages, loading: mLoading } = useAPI("/messages");
  const { data: contacts, loading: cLoading } = useAPI("/contacts");
  const { data: broadcasts, loading: bLoading } = useAPI("/broadcasts/scheduled");
  const { data: automations } = useAPI("/automations");

  const todayMessages = messages?.filter(m => {
    const d = new Date(m.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString() && m.direction === "outbound";
  }) || [];

  const stats = [
    { label: "Messages Sent Today", value: mLoading ? "—" : todayMessages.length, delta: "Outbound today", color: CYAN, icon: "📨" },
    { label: "Total Contacts", value: cLoading ? "—" : (contacts?.length || 0), delta: "In your contact list", color: INDIGO, icon: "👥" },
    { label: "Scheduled Broadcasts", value: bLoading ? "—" : (broadcasts?.filter(b => b.status === "pending")?.length || 0), delta: "Pending to send", color: "#A78BFA", icon: "📢" },
    { label: "Active Keywords", value: automations?.filter(a => a.is_active)?.length || 0, delta: "Keyword automations", color: SUCCESS, icon: "🤖" },
  ];

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT1, letterSpacing: -0.5, marginBottom: 4 }}>Good morning, Sunrise Medical 👋</h1>
        <p style={{ color: TEXT2, fontSize: 14 }}>Here's what's happening with your WhatsApp automation.</p>
      </div>

      <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 20 }}>📱</span>
        <div style={{ flex: 1 }}>
          <span style={{ color: TEXT1, fontSize: 13, fontWeight: 600 }}>+260 97 123 4567</span>
          <span style={{ color: TEXT2, fontSize: 13 }}> · Connected and receiving messages</span>
        </div>
        <div className="badge badge-green">● Live</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: TEXT1, letterSpacing: -1.5, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Recent messages */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: TEXT1 }}>Recent Messages</span>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setActive("messages")}>View all →</button>
        </div>
        {mLoading ? <Loader /> : !messages?.length ? <Empty msg="No messages yet" /> : messages.slice(0, 5).map((m, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 3fr auto auto", gap: 16 }}>
            <div style={{ fontSize: 12, color: TEXT1, fontWeight: 500 }}>{m.from_number || m.to_number}</div>
            <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
            <div className={`badge ${m.direction === "inbound" ? "badge-blue" : "badge-green"}`}>{m.direction}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BROADCASTS ────────────────────────────────────────────────────────────────
function Broadcasts() {
  const { data, loading, refetch } = useAPI("/broadcasts/scheduled");
  const [tab, setTab] = useState("all");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ message: "", phone: "" });

  const filtered = (data || []).filter(b => tab === "all" || b.status === tab);

  const sendNow = async () => {
    if (!form.message || !form.phone) return;
    setSending(true);
    try {
      await fetch(`${API}/broadcasts/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: [{ name: "Test", phone_number: form.phone }],
          message: form.message,
        }),
      });
      alert("Broadcast sent!");
      setForm({ message: "", phone: "" });
      refetch();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Broadcasts</h2>
          <p style={{ color: TEXT2, fontSize: 13, marginTop: 2 }}>Send and schedule bulk WhatsApp messages</p>
        </div>
      </div>

      {/* Quick send form */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: TEXT1, marginBottom: 16 }}>Send a Message</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6, fontWeight: 500 }}>Phone Number</div>
            <input className="input" placeholder="+260971234567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6, fontWeight: 500 }}>Message</div>
            <textarea className="textarea" placeholder="Hi {{name}}, your message here..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          </div>
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={sendNow} disabled={sending}>
            <Icon name="send" size={13} color="white" />
            {sending ? "Sending..." : "Send Now"}
          </button>
        </div>
      </div>

      {/* Scheduled broadcasts */}
      <div style={{ fontWeight: 700, fontSize: 15, color: TEXT1, marginBottom: 14 }}>Scheduled Broadcasts</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {["all", "pending", "completed", "sending"].map(t => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        <div className="table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, background: "rgba(255,255,255,0.02)" }}>
          {["Name", "Recipients", "Scheduled", "Status"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: TEXT2, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No broadcasts yet" /> : filtered.map((b, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{b.broadcast_name}</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{b.contacts?.length || 0}</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{new Date(b.scheduled_at).toLocaleDateString()}</div>
            <div className={`badge ${b.status === "completed" ? "badge-green" : b.status === "pending" ? "badge-yellow" : "badge-blue"}`} style={{ textTransform: "capitalize" }}>{b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CONTACTS ─────────────────────────────────────────────────────────────────
function Contacts() {
  const { data, loading, refetch } = useAPI("/contacts");
  const [search, setSearch] = useState("");

  const filtered = (data || []).filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone_number?.includes(search)
  );

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Contacts</h2>
          <p style={{ color: TEXT2, fontSize: 13, marginTop: 2 }}>{loading ? "Loading..." : `${data?.length || 0} contacts`}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost"><Icon name="upload" size={14} color={TEXT2} /> Import CSV</button>
          <button className="btn btn-primary" onClick={refetch}><Icon name="refresh" size={14} color="white" /> Refresh</button>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
          <Icon name="search" size={15} color={TEXT2} />
        </div>
        <input className="input" placeholder="Search by name or phone..." style={{ paddingLeft: 38 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        <div className="table-row" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 16, background: "rgba(255,255,255,0.02)" }}>
          {["Name", "Phone", "Tag", "Added"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: TEXT2, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No contacts found" /> : filtered.map((c, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO2})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {(c.name || "?").charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{c.name || "Unknown"}</span>
            </div>
            <div style={{ fontSize: 13, color: TEXT2 }}>{c.phone_number}</div>
            <div className={`badge ${c.tag === "VIP" ? "badge-yellow" : "badge-blue"}`}>{c.tag || "Contact"}</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MESSAGE LOG ───────────────────────────────────────────────────────────────
function MessageLog() {
  const { data, loading, refetch } = useAPI("/messages");
  const [search, setSearch] = useState("");

  const filtered = (data || []).filter(m =>
    m.message_body?.toLowerCase().includes(search.toLowerCase()) ||
    m.from_number?.includes(search) ||
    m.to_number?.includes(search)
  );

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Message Log</h2>
          <p style={{ color: TEXT2, fontSize: 13, marginTop: 2 }}>{loading ? "Loading..." : `${data?.length || 0} messages total`}</p>
        </div>
        <button className="btn btn-ghost" onClick={refetch}><Icon name="refresh" size={14} color={TEXT2} /> Refresh</button>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
          <Icon name="search" size={15} color={TEXT2} />
        </div>
        <input className="input" placeholder="Search messages..." style={{ paddingLeft: 38 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        <div className="table-row" style={{ gridTemplateColumns: "1.2fr 3fr 100px 100px", gap: 16, background: "rgba(255,255,255,0.02)" }}>
          {["Contact", "Message", "Direction", "Time"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: TEXT2, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {loading ? <Loader /> : !filtered.length ? <Empty msg="No messages yet" /> : filtered.slice(0, 50).map((m, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: "1.2fr 3fr 100px 100px", gap: 16 }}>
            <div style={{ fontSize: 12, color: TEXT1, fontWeight: 500 }}>{m.from_number || m.to_number || "—"}</div>
            <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message_body}</div>
            <div className={`badge ${m.direction === "inbound" ? "badge-blue" : "badge-green"}`} style={{ textTransform: "capitalize" }}>{m.direction}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AUTOMATIONS ───────────────────────────────────────────────────────────────
function Automations() {
  const { data, loading, refetch } = useAPI("/automations");
  const [form, setForm] = useState({ keyword: "", reply: "" });
  const [saving, setSaving] = useState(false);

  const addKeyword = async () => {
    if (!form.keyword || !form.reply) return;
    setSaving(true);
    try {
      await fetch(`${API}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: "keyword",
          trigger_value: form.keyword.toUpperCase(),
          message_template: form.reply,
        }),
      });
      setForm({ keyword: "", reply: "" });
      refetch();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id, current) => {
    await fetch(`${API}/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    refetch();
  };

  const keywords = (data || []).filter(a => a.trigger_type === "keyword");

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Automations</h2>
          <p style={{ color: TEXT2, fontSize: 13, marginTop: 2 }}>Keyword triggers and automated replies</p>
        </div>
      </div>

      {/* Add keyword form */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: TEXT1, marginBottom: 16 }}>Add New Keyword</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6, fontWeight: 500 }}>Keyword</div>
            <input className="input" placeholder="e.g. PRICING" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6, fontWeight: 500 }}>Auto-reply message</div>
            <input className="input" placeholder="The message to send when keyword is received" value={form.reply} onChange={e => setForm(f => ({ ...f, reply: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={addKeyword} disabled={saving}>
            <Icon name="plus" size={14} color="white" />
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        <div className="table-row" style={{ gridTemplateColumns: "1fr 3fr 100px 80px", gap: 16, background: "rgba(255,255,255,0.02)" }}>
          {["Keyword", "Reply", "Status", ""].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: TEXT2, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {loading ? <Loader /> : !keywords.length ? <Empty msg="No keywords yet" /> : keywords.map((k, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 3fr 100px 80px", gap: 16 }}>
            <div style={{ background: "rgba(91,91,214,0.1)", border: "1px solid rgba(91,91,214,0.2)", borderRadius: 6, padding: "4px 10px", display: "inline-block", fontSize: 12, fontWeight: 700, color: "#A5A5FF", letterSpacing: 0.5 }}>{k.trigger_value}</div>
            <div style={{ fontSize: 12, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.message_template}</div>
            <div className={`badge ${k.is_active ? "badge-green" : "badge-red"}`}>{k.is_active ? "Active" : "Inactive"}</div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => toggle(k.id, k.is_active)}>
              {k.is_active ? "Pause" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings() {
  return (
    <div style={{ padding: "28px", maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>Account & Billing</h2>
        <p style={{ color: TEXT2, fontSize: 13, marginTop: 2 }}>Manage your ZedPing subscription</p>
      </div>
      <div style={{ background: "rgba(91,91,214,0.06)", border: "1px solid rgba(91,91,214,0.2)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT1, marginBottom: 4 }}>Business Plan</div>
            <div style={{ fontSize: 13, color: TEXT2 }}>K1,500/month · Renews 1 June 2026</div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }}>Upgrade to Pro →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[["3,000", "Messages/month"], ["1,847", "Used this month"], ["1,153", "Remaining"]].map(([v, l]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: TEXT1, letterSpacing: -0.5 }}>{v}</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: TEXT1, marginBottom: 16 }}>Business Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["Business Name", "Sunrise Medical"], ["Email", "admin@sunrisemedical.zm"], ["Phone", "+260 97 123 4567"]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: TEXT2, marginBottom: 6, fontWeight: 500 }}>{label}</div>
              <input className="input" defaultValue={val} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState("overview");

  const pages = {
    overview:    { title: "Overview",        subtitle: "Live data from your ZedPing backend", component: <Overview setActive={setActive} /> },
    broadcasts:  { title: "Broadcasts",      subtitle: "Send and schedule bulk messages",     component: <Broadcasts /> },
    contacts:    { title: "Contacts",        subtitle: "Your contact lists",                  component: <Contacts /> },
    messages:    { title: "Message Log",     subtitle: "All inbound and outbound messages",   component: <MessageLog /> },
    automations: { title: "Automations",     subtitle: "Keyword triggers and auto-replies",   component: <Automations /> },
    settings:    { title: "Account & Billing", subtitle: "Manage your subscription",          component: <Settings /> },
  };

  const current = pages[active];

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} />
        <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column" }}>
          <Topbar title={current.title} subtitle={current.subtitle} />
          <div style={{ flex: 1, overflowY: "auto" }}>
            {current.component}
          </div>
        </div>
      </div>
    </>
  );
}