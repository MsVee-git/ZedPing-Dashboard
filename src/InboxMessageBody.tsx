const BACKGROUND_PREFIX = '[Earlier outbound message — background, not a quoted reply]\n';

// Legacy outbound context is useful history, not evidence of a native quoted reply.
// Collapse only the explicitly marked background records; ordinary messages stay visible.
type InboxMessage = {
  direction?: string;
  message_body?: string;
  ad_referral?: { source_type?: string; headline?: string | null } | null;
};

export function InboxMessageBody({ message }: { message: InboxMessage }) {
  const body = message.message_body || '';
  if (message.direction === 'outbound' && body.startsWith(BACKGROUND_PREFIX)) {
    return <details className="inbox-campaign-context"><summary>Previous campaign <span>Background · not a quoted reply</span></summary><div className="inbox-message-body">{body.slice(BACKGROUND_PREFIX.length)}</div></details>;
  }
  if (message.direction === 'inbound' && message.ad_referral?.source_type === 'ad') {
    return <>
      <div className="inbox-ad-source">
        <span className="badge badge-cream">From an ad</span>
        {message.ad_referral.headline && <strong>{message.ad_referral.headline}</strong>}
      </div>
      {body && <div className="inbox-message-body">{body}</div>}
    </>;
  }
  return <div className="inbox-message-body">{body}</div>;
}
