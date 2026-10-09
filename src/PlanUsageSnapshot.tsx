import { RouteLink, Surface } from './WorkspaceUI';
import { proposedPlans } from './lib/planUsage';

export function PlanUsageSnapshot({ customer, navigate }: any) {
  const plan = proposedPlans.find(item => item.id === customer?.subscription_plan);
  return <Surface title="Plan & usage" action={<RouteLink route="billing" navigate={navigate}>View usage →</RouteLink>}>
    <div className="billing-plan"><strong>{plan?.name || 'Plan unavailable'}</strong><span className="muted">{customer?.subscription_status || 'Status unavailable'}</span></div>
    <dl className="usage-snapshot">
      <div><dt>Template messages remaining</dt><dd>Not available yet</dd></div>
      {plan && plan.agents > 0 && <div><dt>ZedPing AI replies remaining</dt><dd>Not available yet</dd></div>}
      {plan?.id === 'starter' && <div><dt>ZedPing AI</dt><dd>Not included in upcoming Starter</dd></div>}
    </dl>
    <p className="surface-footnote">Balances will appear once usage tracking is connected. Existing subscription terms remain in effect.</p>
    <a className="btn btn-wire" href="https://wa.me/260778621167?text=Hello%20ZedPing%2C%20I%20would%20like%20to%20request%20extra%20messaging%20usage." target="_blank" rel="noreferrer">Request a usage top-up</a>
  </Surface>;
}
