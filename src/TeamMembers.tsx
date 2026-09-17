// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

const API = "https://zedping-backend-production.up.railway.app";

function displayRole(role) {
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member";
}

function invitationDate(value) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function TeamMembers({ customer, apiFetch }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState("");

  const canManage = ["owner", "admin"].includes(customer?.role);

  const load = async () => {
    if (!customer?.id) return;
    setLoading(true);
    setError("");
    try {
      const requests = [apiFetch(`${API}/team/members`)];
      if (canManage) requests.push(apiFetch(`${API}/team/invitations`));
      const responses = await Promise.all(requests);
      setMembers(await responses[0].json());
      setInvitations(canManage ? await responses[1].json() : []);
    } catch (loadError) {
      setError(loadError?.message || "We could not load your team.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMembers([]);
    setInvitations([]);
    setNotice("");
    load();
  }, [customer?.id, customer?.role]);

  const createInvitation = async (event) => {
    event.preventDefault();
    setInviting(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`${API}/team/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite)
      });
      setInvite({ email: "", role: "member" });
      setNotice("Invitation sent. It expires in 7 days.");
      await load();
    } catch (actionError) {
      setError(actionError?.message || "We could not send this invitation.");
    } finally {
      setInviting(false);
    }
  };

  const act = async (key, endpoint, init = {}) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await apiFetch(`${API}${endpoint}`, init);
      setNotice("Team updated.");
      await load();
    } catch (actionError) {
      setError(actionError?.message || "We could not update the team.");
    } finally {
      setBusy("");
    }
  };

  const pending = useMemo(() => invitations.filter((item) => item.status === "pending"), [invitations]);

  return <div style={{ padding: "28px 32px 48px", maxWidth: 980 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--gold2)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>Workspace settings</div>
        <h1 className="editorial" style={{ fontSize: 42, fontWeight: 600 }}>Team Members</h1>
        <p style={{ color: "var(--mist)", fontSize: 14, lineHeight: 1.65, marginTop: 7 }}>Give each colleague their own secure ZedPing login. Everyone shares this workspace’s inbox and permissions.</p>
      </div>
      <button type="button" className="btn btn-wire" onClick={load} disabled={loading}>Refresh</button>
    </div>

    {error && <div role="alert" style={{ marginBottom: 16, padding: "12px 14px", border: "1px solid rgba(239,68,68,.35)", color: "var(--error-text)", fontSize: 13 }}>{error}</div>}
    {notice && <div role="status" style={{ marginBottom: 16, padding: "12px 14px", border: "1px solid rgba(34,197,94,.3)", color: "var(--success-text)", fontSize: 13 }}>{notice}</div>}

    {canManage && <section style={{ background: "var(--panel)", border: "1px solid var(--wire)", padding: 20, marginBottom: 20 }}>
      <h2 className="editorial" style={{ fontSize: 28, fontWeight: 600 }}>Invite a team member</h2>
      <p style={{ color: "var(--mist)", fontSize: 13, marginTop: 5, marginBottom: 16 }}>They must verify the invited email before they can join.</p>
      <form onSubmit={createInvitation} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px auto", gap: 10 }}>
        <input className="input" required type="email" aria-label="Team member email" placeholder="colleague@business.com" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} />
        <select className="input" aria-label="Invitation role" value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}>
          <option value="member">Member</option><option value="admin">Admin</option>
        </select>
        <button className="btn btn-gold" type="submit" disabled={inviting}>{inviting ? "Sending…" : "Send invite"}</button>
      </form>
    </section>}

    <section style={{ background: "var(--panel)", border: "1px solid var(--wire)", marginBottom: 20 }}>
      <div style={{ padding: "17px 20px", borderBottom: "1px solid var(--wire)", display: "flex", justifyContent: "space-between" }}>
        <h2 className="editorial" style={{ fontSize: 28, fontWeight: 600 }}>Active members</h2>
        <span className="mono" style={{ fontSize: 10, color: "var(--mist)", alignSelf: "center" }}>{members.length} MEMBER{members.length === 1 ? "" : "S"}</span>
      </div>
      {loading ? <div style={{ padding: 24, color: "var(--mist)" }}>Loading team…</div> : members.map((member) => <div key={member.id} style={{ padding: "16px 20px", borderBottom: "1px solid var(--wire)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div style={{ fontWeight: 600 }}>{member.name || member.email || "Workspace member"}</div>
          <div style={{ color: "var(--mist)", fontSize: 12, marginTop: 3 }}>{member.email || "Email unavailable"}</div>
        </div>
        <span className="badge" style={{ color: member.role === "owner" ? "var(--gold2)" : "var(--cream2)", border: "1px solid var(--wire)" }}>{displayRole(member.role)}</span>
        {canManage && member.role !== "owner" && <div style={{ display: "flex", gap: 8 }}>
          <select className="input" aria-label={`Change ${member.email || "member"} role`} value={member.role} disabled={busy === `role-${member.id}`} onChange={(event) => act(`role-${member.id}`, `/team/members/${encodeURIComponent(member.id)}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: event.target.value }) })} style={{ width: 110, padding: "8px 9px", fontSize: 12 }}>
            <option value="member">Member</option><option value="admin">Admin</option>
          </select>
          <button type="button" className="btn btn-danger" disabled={busy === `remove-${member.id}`} onClick={() => { if (window.confirm(`Remove ${member.email || "this member"} from this workspace?`)) act(`remove-${member.id}`, `/team/members/${encodeURIComponent(member.id)}`, { method: "DELETE" }); }}>Remove</button>
        </div>}
      </div>)}
    </section>

    {canManage && <section style={{ background: "var(--panel)", border: "1px solid var(--wire)" }}>
      <div style={{ padding: "17px 20px", borderBottom: "1px solid var(--wire)", display: "flex", justifyContent: "space-between" }}>
        <h2 className="editorial" style={{ fontSize: 28, fontWeight: 600 }}>Pending invitations</h2>
        <span className="mono" style={{ fontSize: 10, color: "var(--mist)", alignSelf: "center" }}>{pending.length} PENDING</span>
      </div>
      {!pending.length ? <div style={{ padding: 20, color: "var(--mist)", fontSize: 13 }}>No pending invitations.</div> : pending.map((item) => <div key={item.id} style={{ padding: "18px 20px", borderBottom: "1px solid var(--wire)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ color: "var(--cream)", fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{item.email_normalized}</div>
          <div style={{ color: "var(--cream2)", fontSize: 12, marginTop: 6 }}>{displayRole(item.intended_role)} <span style={{ color: "var(--mist)" }}>·</span> <span style={{ color: "var(--gold2)" }}>Pending</span></div>
          <div style={{ color: "var(--mist)", fontSize: 11, marginTop: 5 }}>Invited {invitationDate(item.created_at)} · Expires {invitationDate(item.expires_at)}</div>
        </div>
        <button type="button" className="btn btn-wire" disabled={busy === `resend-${item.id}`} onClick={() => act(`resend-${item.id}`, `/team/invitations/${encodeURIComponent(item.id)}/resend`, { method: "POST" })}>{busy === `resend-${item.id}` ? "Sending…" : "Resend invitation"}</button>
        <button type="button" className="btn btn-danger" disabled={busy === `revoke-${item.id}`} onClick={() => { if (window.confirm(`Revoke the invitation for ${item.email_normalized}?`)) act(`revoke-${item.id}`, `/team/invitations/${encodeURIComponent(item.id)}/revoke`, { method: "POST" }); }}>Revoke</button>
      </div>)}
    </section>}
  </div>;
}
