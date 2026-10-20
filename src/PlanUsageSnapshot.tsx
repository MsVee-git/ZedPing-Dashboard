import { RouteLink, Surface } from './WorkspaceUI';
import { proposedPlans } from './lib/planUsage';
import { MessagingUsage } from './MessagingUsage';

export function PlanUsageSnapshot({ customer, navigate, request }: any) {
  const plan = proposedPlans.find(item => item.id === customer?.subscription_plan);
  return <Surface title="Plan & usage" action={<RouteLink route="billing" navigate={navigate}>View usage →</RouteLink>}>
    <div className="usage-snapshot-body"><div className="billing-plan"><strong>{plan?.name || 'Plan unavailable'}</strong><span className="muted">{customer?.subscription_status || 'Status unavailable'}</span></div>
    <MessagingUsage customer={customer} request={request} compact />
    </div>
  </Surface>;
}
