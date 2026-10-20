export const proposedPlans = Object.freeze([
  { id: 'starter', name: 'Starter', price: 1200, templates: 1000, agents: 0, aiReplies: null },
  { id: 'business', name: 'Business', price: 2500, templates: 3000, agents: 1, aiReplies: 1000 },
  { id: 'pro', name: 'Pro', price: 5000, templates: 5000, agents: 3, aiReplies: 3000 },
]);

// Only complete server snapshots can represent a spendable balance.
export function usageBalance(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.limit) || !Number.isSafeInteger(snapshot.used)
      || snapshot.limit < 0 || snapshot.used < 0 || !snapshot.periodStart || !snapshot.periodEnd) return null;
  return { ...snapshot, remaining: Math.max(0, snapshot.limit - snapshot.used),
    percent: snapshot.limit === 0 ? 0 : Math.min(100, snapshot.used / snapshot.limit * 100),
    exhausted: snapshot.used >= snapshot.limit };
}

export function messagingUsageView(data) {
  const messages = {
    renewal_required: 'Your messaging period has ended. Template sending is paused until renewal. Contact ZedPing to renew.',
    activation_required: 'Your messaging allowance needs activation. Contact ZedPing for assistance.',
    not_managed: 'Your number uses direct Meta billing. A verified ZedPing usage balance is not available for this connection; Meta charges are separate.',
    unavailable: 'Your messaging balance is temporarily unavailable. Refresh or contact ZedPing.'
  };
  if (!data || !['active', 'allowance_exhausted'].includes(data.state)) return { balance: null, message: messages[data?.state] || messages.unavailable };
  const snapshot = { limit: data.allowance, used: data.used, periodStart: data.period_start, periodEnd: data.period_end };
  const validDates = Number.isFinite(Date.parse(snapshot.periodStart)) && Number.isFinite(Date.parse(snapshot.periodEnd)) && Date.parse(snapshot.periodEnd) > Date.parse(snapshot.periodStart);
  const balance = validDates ? usageBalance(snapshot) : null;
  if (!balance) return { balance: null, message: messages.unavailable };
  return { balance, warning: balance.exhausted ? 'Allowance used. Additional template sending is paused. Request extra messages to continue.' : balance.percent >= 80 ? 'You have used at least 80% of your allowance. Arrange a top-up before your balance runs out.' : null };
}
