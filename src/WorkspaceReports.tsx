import { PageTitle, ResourceState, Surface, useResource, AgentBadge } from './WorkspaceUI';
import { campaignStatus } from './WorkspaceOverview';

export function WorkspaceReports({customer,request,tab='messaging'}:any){
  const paths={messaging:'/messages',campaigns:'/broadcasts/scheduled',conversations:'/conversations/counts',automations:'/automations',ai:'/ai-agents'};
  const resource=useResource(request,paths[tab]||paths.messaging,customer.id);
  const rows=Array.isArray(resource.data)?resource.data:tab==='ai'?resource.data?.agents||[]:[];
  const titles={messaging:'Messaging',campaigns:'Campaigns',conversations:'Conversations',automations:'Automations',ai:'Zed AI'};
  const metrics=tab==='conversations' ? [['Needs attention',resource.data?.needs_attention],['AI handling',resource.data?.zoe],['Resolved',resource.data?.resolved]]
    : tab==='messaging' ? [['Recorded messages',rows.length],['Inbound',rows.filter((r:any)=>r.direction==='inbound').length],['Outbound',rows.filter((r:any)=>r.direction==='outbound').length]]
    : tab==='campaigns' ? [['Recorded campaigns',rows.length],['Processed',rows.filter((r:any)=>r.status==='completed').length],['Failed',rows.filter((r:any)=>r.status==='failed').length]]
    : tab==='ai' ? [['Agents',rows.length],['Live',rows.filter((r:any)=>r.lifecycle_status==='active'&&r.deployment_mode==='live').length],['Test',rows.filter((r:any)=>r.lifecycle_status==='active'&&r.deployment_mode==='test').length]]
    : [['Automations',rows.length],['Active',rows.filter((r:any)=>r.is_active).length],['Paused',rows.filter((r:any)=>!r.is_active).length]];
  return <div className="pad"><PageTitle title="Analytics" description={titles[tab]+' · current workspace snapshot'} action={<button className="btn btn-wire" onClick={resource.retry}>Refresh</button>}/><ResourceState resource={resource}>
    <div className="metric-grid">{metrics.map(([label,value])=><div className="metric" key={label}><strong>{value??'—'}</strong><span>{label}</span></div>)}</div>
    <Surface title={titles[tab]+' activity'}>{tab==='conversations'?<p className="surface-message">Current queue counts. Assignment and ownership are managed in Team Inbox.</p>:!rows.length?<p className="surface-message">No recorded activity yet.</p>:<div className="table-scroll"><table className="work-table"><thead><tr><th>{tab==='messaging'?'Contact':'Name'}</th><th>Status</th></tr></thead><tbody>{rows.slice(0,30).map((row:any,index:number)=><tr key={row.id||index}><td>{row.name||row.broadcast_name||row.from_number||row.to_number||row.automation_type||row.trigger_type||'Untitled'}</td><td>{tab==='ai'?<AgentBadge agent={row}/>:tab==='campaigns'?campaignStatus(row.status):tab==='automations'?row.is_active?'Active':'Paused':row.direction||'Not recorded'}</td></tr>)}</tbody></table></div>}</Surface>
    <p className="report-note">This snapshot uses the records currently available to your workspace. Message and campaign totals cover returned records, not an all-time report. Delivery/read rates, response time and AI resolution rates are not available for these records. Missing measurements are never shown as zero.</p>
  </ResourceState></div>;
}

export { PlanUsageBilling as WorkspaceBilling } from './PlanUsageBilling';
export function WorkspaceIntegrations(){return <div className="pad"><PageTitle title="Integrations" description="Connect the tools your team uses."/><Surface title="Workspace integrations"><p className="surface-message">WhatsApp is managed under WhatsApp → Numbers & connection. For special integrations, contact ZedPing to discuss your requirements.</p><a className="btn btn-wire billing-action" href="https://wa.me/260778621167?text=Hello%20ZedPing%2C%20I%20would%20like%20to%20discuss%20an%20integration." target="_blank" rel="noreferrer">Discuss an integration</a></Surface></div>;}
