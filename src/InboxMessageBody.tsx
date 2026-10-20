const BACKGROUND_PREFIX = '[Earlier outbound message — background, not a quoted reply]\n';

// Legacy outbound context is useful history, not evidence of a native quoted reply.
// Collapse only the explicitly marked background records; ordinary messages stay visible.
export function InboxMessageBody({ message }: { message: { direction?: string; message_body?: string } }) {
  const body = message.message_body || '';
  if (message.direction === 'outbound' && body.startsWith(BACKGROUND_PREFIX)) {
    return <details className="inbox-campaign-context"><summary>Previous campaign <span>Background · not a quoted reply</span></summary><div className="inbox-message-body">{body.slice(BACKGROUND_PREFIX.length)}</div></details>;
  }
  return <div className="inbox-message-body">{body}</div>;
}
