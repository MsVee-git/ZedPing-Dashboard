import React from "react";

export function MarketingOptOutBadge({ contact }: { contact?: { marketing_opted_out?: boolean } | null }) {
  if (contact?.marketing_opted_out !== true) return null;
  return <span className="badge badge-gold" title="Excluded from marketing broadcasts. Service conversations remain available.">MARKETING OPTED OUT</span>;
}

type Review = {
  audience: { name: string };
  total_selected: number;
  eligible_recipients: number;
  opted_out_recipients: number;
  skipped_recipients: number;
  suppressed?: { id?: string; name?: string; phone_number?: string }[];
};

export function BroadcastReviewSummary({ review }: { review: Review }) {
  return <section aria-label="Recipient eligibility" style={{ marginTop: 12, color: "var(--mist)", fontSize: 12 }}>
    <div style={{ color: "var(--cream)", marginBottom: 8 }}>{review.audience.name}</div>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "6px 18px", maxWidth: 420 }}>
      <dt>Selected contacts</dt><dd style={{ margin: 0 }}>{review.total_selected}</dd>
      <dt>Eligible recipients</dt><dd style={{ margin: 0 }}>{review.eligible_recipients}</dd>
      <dt>Marketing opted out</dt><dd style={{ margin: 0 }}>{review.opted_out_recipients ?? 0}</dd>
      <dt>Invalid/unavailable</dt><dd style={{ margin: 0 }}>{review.skipped_recipients}</dd>
    </dl>
    {review.opted_out_recipients > 0 && <div style={{ marginTop: 10 }}>
      <p>Marketing-opted-out contacts are excluded and will not receive this broadcast.</p>
      {!!review.suppressed?.length && <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", color: "var(--gold2)" }}>View excluded contacts ({review.suppressed.length})</summary>
        <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
          {review.suppressed.map((contact, index) => <li key={contact.id || index}>{contact.name || "Unnamed contact"}{contact.phone_number ? ` · ${contact.phone_number}` : ""} — Marketing opted out</li>)}
        </ul>
      </details>}
    </div>}
    <p style={{ marginTop: 10 }}>Eligibility is checked again when you send.</p>
  </section>;
}
