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
