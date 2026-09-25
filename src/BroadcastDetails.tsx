import React, { useEffect, useRef, useState } from "react";

type Activity = {
  id: string; broadcast_name?: string; message?: string; status?: string;
  recorded_recipients?: number | null; sent_count?: number | null; failed_count?: number | null;
  created_at?: string; scheduled_at?: string; completed_at?: string;
};

function recordedTime(value?: string) {
  if (!value) return "Not recorded";
  // Existing history timestamps are UTC stored without a timezone suffix.
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

export function BroadcastHistoryFacts({ activity }: { activity: Activity }) {
  const rows = [
    ["Broadcast name", activity.broadcast_name || "Untitled Broadcast"],
    ["Stored message / template", activity.message || "Not recorded"],
    ["Status", activity.status === "completed" ? "Processed" : activity.status || "Not recorded"],
    ["Created", recordedTime(activity.created_at)],
    ["Scheduled / send started", recordedTime(activity.scheduled_at)],
    ["Processing completed", recordedTime(activity.completed_at)],
    ["Recorded recipients", activity.recorded_recipients ?? "Not recorded"],
    ["Accepted for sending", activity.sent_count ?? "Not recorded"],
    ["Failed", activity.failed_count ?? "Not recorded"],
    ["Originally selected", "Not recorded"],
    ["Marketing opted out at send time", "Not recorded"],
    ["Contact Group at send time", "Not recorded"],
    ["Sending telephone number at send time", "Not recorded"]
  ];
  return <>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "10px 20px", fontSize: 12 }}>
      {rows.map(([label, value]) => <React.Fragment key={label}><dt style={{ color: "var(--mist)" }}>{label}</dt><dd style={{ margin: 0, color: "var(--cream)", overflowWrap: "anywhere" }}>{value}</dd></React.Fragment>)}
    </dl>
    <p style={{ color: "var(--mist)", fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>Only saved broadcast facts are shown. Historical selection, exclusion, group and telephone-number details were not recorded. Current contact consent is not used to reconstruct them. Accepted for sending does not confirm delivery.</p>
  </>;
}

export function BroadcastDetails({ id, apiBase, apiFetch, onClose }: { id: string; apiBase: string; apiFetch: (url: string, init?: RequestInit) => Promise<Response>; onClose: () => void }) {
  const [result, setResult] = useState<{ id: string; activity?: Activity; error?: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    heading.current?.focus();
    apiFetch(`${apiBase}/broadcasts/scheduled/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Could not load broadcast details."); return response.json(); })
      .then(activity => { if (active) setResult({ id, activity }); })
      .catch(error => { if (active) setResult({ id, error: error.message || "Could not load broadcast details." }); });
    return () => { active = false; controller.abort(); };
  }, [id, apiBase, apiFetch]);
  const current = result?.id === id ? result : null;
  return <section id="broadcast-details" className="card" aria-labelledby="broadcast-details-title" style={{ padding: 24, marginTop: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
      <h2 ref={heading} tabIndex={-1} id="broadcast-details-title" className="editorial" style={{ color: "var(--cream)", fontSize: 26 }}>Broadcast details</h2>
      <button className="btn btn-wire" onClick={onClose}>Close details</button>
    </div>
    {!current ? <p role="status">Loading broadcast details…</p> : current.error ? <p role="alert" style={{ color: "var(--error-text)" }}>{current.error}</p> : current.activity ? <BroadcastHistoryFacts activity={current.activity} /> : null}
  </section>;
}
