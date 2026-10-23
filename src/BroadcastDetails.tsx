import React, { useEffect, useRef, useState } from "react";
import { BroadcastSubmissionReceipt } from './BroadcastSubmissionReceipt';
import { campaignReceipt, campaignStatus } from './lib/campaignStatus.js';

type Activity = {
  id: string; broadcast_name?: string; message?: string; status?: string;
  recorded_recipients?: number | null; sent_count?: number | null; failed_count?: number | null;
  created_at?: string; scheduled_at?: string; completed_at?: string;
  delivery?: {delivered:number;read:number;failed:number;sent_pending:number;accepted_pending:number;unconfirmed:number;submission_failures:number;failure_reasons:Record<string,number>} | null;
};

function recordedTime(value?: string) {
  if (!value) return "Not recorded";
  // Existing history timestamps are UTC stored without a timezone suffix.
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-GB", { timeZone: "Africa/Lusaka" }) + " CAT";
}

export function BroadcastHistoryFacts({ activity }: { activity: Activity }) {
  const rows = [
    ["Broadcast name", activity.broadcast_name || "Untitled Broadcast"],
    ["Stored message / template", activity.message || "Not recorded"],
    ["Status", campaignStatus(activity).label],
    ["Created", recordedTime(activity.created_at)],
    ["Scheduled / send started", recordedTime(activity.scheduled_at)],
    ["Sending completed", recordedTime(activity.completed_at)],
    ["Recorded recipients", activity.recorded_recipients ?? "Not recorded"],
    ["Accepted for sending", activity.sent_count ?? "Not recorded"],
    ["Submission failures", activity.failed_count ?? "Not recorded"],
    ["Delivered (includes read)", activity.delivery?.delivered ?? "Not available"],
    ["Read", activity.delivery?.read ?? "Not available"],
    ["Provider failures", activity.delivery?.failed ?? "Not available"],
    ["Awaiting delivery outcome", activity.delivery ? activity.delivery.sent_pending + activity.delivery.accepted_pending : "Not available"],
    ["Unconfirmed legacy messages", activity.delivery?.unconfirmed ?? "Not available"],
    ["Originally selected", "Not recorded"],
    ["Marketing opted out at send time", "Not recorded"],
    ["Contact Group at send time", "Not recorded"],
    ["Sending telephone number at send time", "Not recorded"]
  ];
  return <>
    <BroadcastSubmissionReceipt result={campaignReceipt(activity)} />
    {activity.status === 'sending' && <p role="status" style={{fontSize:16}}>Sending broadcast… This status updates automatically. You can leave this page and check it again later.</p>}
    {activity.delivery && activity.delivery.failed > 0 && <p style={{fontSize:14,lineHeight:1.6}}>{activity.delivery.failed} messages were not delivered by WhatsApp. See the provider failure reasons below. A Sent status does not mean every recipient received the message.</p>}
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "10px 20px", fontSize: 12 }}>
      {rows.map(([label, value]) => <React.Fragment key={label}><dt style={{ color: "var(--mist)" }}>{label}</dt><dd style={{ margin: 0, color: "var(--cream)", overflowWrap: "anywhere" }}>{value}</dd></React.Fragment>)}
    </dl>
    {activity.delivery && Object.keys(activity.delivery.failure_reasons).length > 0 && <div style={{marginTop:16}}><strong>Provider failure reasons</strong><ul>{Object.entries(activity.delivery.failure_reasons).map(([reason,count])=><li key={reason}>{reason} — {count} messages</li>)}</ul></div>}
    <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>Only saved broadcast facts are shown. Historical selection, exclusion, group and telephone-number details were not recorded. Current contact consent is not used to reconstruct them. Accepted for sending does not confirm delivery. Read messages are included in Delivered. Missing read receipts do not prove unread. Older campaigns without saved message links have unavailable delivery metrics.</p>
  </>;
}

export function BroadcastDetails({ id, apiBase, apiFetch, onClose }: { id: string; apiBase: string; apiFetch: (url: string, init?: RequestInit) => Promise<Response>; onClose: () => void }) {
  const [result, setResult] = useState<{ id: string; activity?: Activity; error?: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [revision,setRevision] = useState(0);
  const [refreshing,setRefreshing] = useState(false);
  const [refreshError,setRefreshError] = useState('');
  useEffect(()=>{heading.current?.focus();},[id]);
  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function load() {
      if(busy || !active)return;
      busy=true;setRefreshing(true);
      try {
        const response=await apiFetch(`${apiBase}/broadcasts/scheduled/${encodeURIComponent(id)}`,{signal:controller.signal});
        if(!response.ok)throw new Error('Could not load broadcast details.');
        const activity=await response.json();
        if(active){setResult({id,activity});setRefreshError('');}
      } catch(error:any) {
        if(active){
          const message=error.message || 'Could not refresh campaign activity.';
          setRefreshError(message);
          setResult(previous=>previous?.id===id && previous.activity ? previous : {id,error:message});
        }
      } finally {busy=false;if(active)setRefreshing(false);}
    }
    load();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')load();},10000);
    const onVisible=()=>{if(document.visibilityState==='visible')load();};
    document.addEventListener('visibilitychange',onVisible);
    return () => {active=false;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  }, [id, apiBase, apiFetch, revision]);
  const current = result?.id === id ? result : null;
  return <section id="broadcast-details" className="card" aria-labelledby="broadcast-details-title" style={{ padding: 24, marginTop: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
      <h2 ref={heading} tabIndex={-1} id="broadcast-details-title" className="editorial" style={{ color: "var(--cream)", fontSize: 26 }}>Broadcast details</h2>
      <div style={{display:'flex',gap:8}}><button className="btn btn-wire" disabled={refreshing} onClick={()=>setRevision(value=>value+1)}>{refreshing?'Refreshing…':'Refresh status'}</button><button className="btn btn-wire" onClick={onClose}>Close details</button></div>
    </div>
    <p style={{fontSize:12}}>Status updates every 10 seconds while this page is visible.</p>
    {refreshError && current?.activity && <p role="alert">{refreshError} Showing the last saved activity.</p>}
    {!current ? <p role="status">Loading broadcast details…</p> : current.error ? <p role="alert" style={{ color: "var(--error-text)" }}>{current.error}</p> : current.activity ? <BroadcastHistoryFacts activity={current.activity} /> : null}
  </section>;
}
