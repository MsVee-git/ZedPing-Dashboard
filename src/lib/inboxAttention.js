export function inboxAttentionReasons(row, now = Date.now()) {
  const reasons = [];
  if (row.status === 'needs_attention' && row.control_mode === 'needs_attention') {
    reasons.push('Team handoff');
  }
  const lastInbound = Date.parse(row.last_inbound_at);
  const lastOutbound = Date.parse(row.last_outbound_at);
  if (row.status === 'open' && Number.isFinite(lastInbound) &&
      (!Number.isFinite(lastOutbound) || lastInbound > lastOutbound)) {
    reasons.push('Awaiting reply');
  }
  if (Date.parse(row.callback_due_at) <= now) reasons.push('Callback due');
  return reasons;
}
