import { PageTitle, Surface } from './WorkspaceUI';
import { proposedPlans } from './lib/planUsage';
import './planUsage.css';

const number = (value: number) => value.toLocaleString('en-US');
const support = 'https://wa.me/260778621167?text=';
export function PlanUsageBilling({ customer }: any) {
  const current = customer?.subscription_plan;
  const selected = proposedPlans.find(plan => plan.id === current);
  const contact = (text: string) => support + encodeURIComponent(text);
  return <div className="pad">
    <PageTitle title="Plan & usage" description="Your subscription, messaging balance and ZedPing AI usage." />
    <Surface title="Current subscription">
      <div className="billing-plan"><div><h2>{selected?.name || 'Plan unavailable'}</h2><p className="muted">{customer?.subscription_status || 'Status unavailable'}</p></div>
      <a className="btn btn-wire" href={contact('Hello ZedPing, please confirm my current subscription and billing terms.')} target="_blank" rel="noreferrer">Manage subscription</a></div>
      <p className="surface-footnote">Your existing subscription terms remain in effect. The packages below are upcoming and do not change your current bill.</p>
    </Surface>
    <div className="usage-cards">
      {['Template messages', 'Extra messaging balance', 'ZedPing AI replies'].map(label => <Surface key={label} title={label}>
        <strong className="usage-unknown">—</strong><p className="muted">Balance not available yet</p>
        <p className="surface-footnote">{label === 'ZedPing AI replies' ? 'AI usage will be shown separately from WhatsApp messaging usage.' : label === 'Extra messaging balance' ? 'Purchased usage will appear here once top-ups are available.' : 'Your billing period, used messages and remaining allowance will appear here when usage tracking is available.'}</p>
      </Surface>)}
    </div>
    <Surface title="Upcoming packages">
      <p className="surface-footnote">Proposed monthly packages. Messaging allowances are for outbound templates, not the number of contacts stored.</p>
      <div className="table-scroll"><table className="work-table"><caption className="plan-caption">Monthly packages in Zambian kwacha</caption><thead><tr><th scope="col">Feature</th>{proposedPlans.map(plan => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead>
      <tbody>
        <tr><th scope="row">Monthly subscription</th>{proposedPlans.map(plan => <td key={plan.id}>K{number(plan.price)}</td>)}</tr>
        <tr><th scope="row">Included template messages</th>{proposedPlans.map(plan => <td key={plan.id}>{number(plan.templates)}</td>)}</tr>
        <tr><th scope="row">Chatflows & automations</th>{proposedPlans.map(plan => <td key={plan.id}>Included</td>)}</tr>
        <tr><th scope="row">ZedPing AI agents</th>{proposedPlans.map(plan => <td key={plan.id}>{plan.agents ? (plan.agents === 1 ? '1 agent' : 'Up to 3 agents') : 'Not included'}</td>)}</tr>
        <tr><th scope="row">AI replies / month · provisional</th>{proposedPlans.map(plan => <td key={plan.id}>{plan.aiReplies ? number(plan.aiReplies) + ' shared across agents' : 'Not included'}</td>)}</tr>
        <tr><th scope="row">Knowledge answers & staff handoff</th><td>Rule-based flows</td><td>AI answers & basic handoff</td><td>AI answers & advanced routing*</td></tr>
        <tr><th scope="row">Connected-system AI actions*</th><td>Not included</td><td>Not included</td><td>Approved integrations</td></tr>
      </tbody></table></div>
      <p className="surface-footnote">*Planned features, subject to availability. AI reply allowances are provisional. Customer-service messaging allowances and top-up prices are still being finalized.</p>
    </Surface>
    <Surface title="How your allowance will work">
      <ul className="usage-explanation"><li>A broadcast to 500 recipients uses 500 template messages. Splitting a list does not reduce usage.</li><li>Broadcasts and automated template notifications share the monthly template allowance.</li><li>AI replies use separate AI credit and may also incur WhatsApp service-message charges.</li><li>Before sending, you will see the recipients, allowance needed and any additional usage price.</li><li>When the included allowance runs out, additional sending requires a prepaid top-up. Top-ups will be paid through ZedPing.</li></ul>
      <button className="btn btn-wire" disabled>Top-ups coming soon</button>
      <p className="surface-footnote">Usage controls and centralized billing are not active yet. This page does not collect payments.</p>
    </Surface>
  </div>;
}
