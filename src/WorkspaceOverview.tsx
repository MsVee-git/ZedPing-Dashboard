import { AgentBadge, PageTitle, ResourceState, RouteLink, Surface, useResource } from './WorkspaceUI';
import { PlanUsageSnapshot } from './PlanUsageSnapshot';
import { conversationHandlingStatus } from './ConversationHandlingStatus';

export function connectionLabel(connection:any) {
  if(connection?.provisioning_state==='failed')return 'Failed · needs attention';
  if(connection?.status==='connected' && connection?.provisioning_state==='operational')return 'Connected';
  if(connection?.provisioning_state==='registering')return 'Activation in progress';
  if(connection)return 'Number linked';
  return 'Not connected';
}
export function campaignStatus(status:string){return ({completed:'Processed',pending:'Scheduled',sending:'Sending',failed:'Failed'})[status]||status||'Unknown';}
function catTime(value:any){if(!value)return 'Not recorded';const date=new Date(value);return Number.isNaN(date.getTime())?'Not recorded':date.toLocaleString('en-GB',{timeZone:'Africa/Lusaka',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' CAT';}

export function WorkspaceOverview({customer,request,navigate}:any){
  const setup=useResource(request,'/workspace',customer.id);
  const counts=useResource(request,'/conversations/counts',customer.id);
  const attention=useResource(request,'/conversations?view=needs_attention&offset=0',customer.id);
  const contacts=useResource(request,'/contacts',customer.id);
  const campaigns=useResource(request,'/broadcasts/scheduled',customer.id);
  const agents=useResource(request,'/ai-agents',customer.id);
  const messages=useResource(request,'/messages',customer.id);
  const connection=setup.data?.whatsapp_connection;
  const checklist=setup.data?.setup_checklist;
  const rows=attention.data?.conversations||[];
  const history=Array.isArray(campaigns.data)?campaigns.data:[];
  const messageRows=Array.isArray(messages.data)?messages.data:[];
  const number=(resource:any,value:any)=>resource.loading||resource.error?'—':value??'—';
  const metrics=[['Needs attention',number(counts,counts.data?.needs_attention),'messages'],['AI handling',number(counts,counts.data?.zoe),'messages'],['Contacts',number(contacts,Array.isArray(contacts.data)?contacts.data.length:null),'contacts'],['Sent today',number(messages,Array.isArray(messages.data)?messageRows.filter((m:any)=>m.direction==='outbound' && new Date(m.created_at).toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'})===new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lusaka'})).length:null),'analytics']];
  return <div className="pad overview-page">
    <PageTitle title="Overview" description={new Date().toLocaleDateString('en-GB',{timeZone:'Africa/Lusaka',weekday:'long',day:'numeric',month:'long'})} action={<RouteLink className="btn btn-gold" route={{section:'broadcasts',resourceKind:'campaign',resourceId:'new'}} navigate={navigate}>New campaign</RouteLink>}/>
    <div className="connection-strip"><div><span className={'status-dot '+(connectionLabel(connection)==='Connected'?'good':'warning')}/><strong>WhatsApp · {setup.loading?'Checking connection…':setup.error?'Status unavailable':connectionLabel(connection)}</strong><span className="muted">{connection?.phone_number||'Manage your business number'}</span></div><RouteLink route="whatsapp" navigate={navigate}>View numbers →</RouteLink></div>
    {checklist&&<details className="setup-strip"><summary><strong>{checklist.completed===checklist.total?'Setup complete':'Finish setup'}</strong><span>{checklist.completed} of {checklist.total} complete</span><span className="setup-open">View checklist</span></summary><div className="setup-checklist">{checklist.items?.map((item:any)=><div key={item.key}>{item.complete?'✓':'○'} {item.label}</div>)}<RouteLink route="settings" navigate={navigate} className="btn btn-wire">Continue setup</RouteLink></div></details>}
    <div className="metric-grid">{metrics.map(([label,value,section])=><RouteLink key={label} route={section} navigate={navigate} className="metric"><strong>{value}</strong><span>{label}</span></RouteLink>)}</div>
    <div className="overview-columns"><div>
      <Surface title="Needs your attention" action={<RouteLink route="messages" navigate={navigate}>Open inbox →</RouteLink>}>
        <ResourceState resource={attention} empty={!rows.length}>{rows.slice(0,4).map((row:any)=><div className="attention-row" key={row.id}><div className="avatar">{(row.contacts?.name||'?').slice(0,1)}</div><div><strong>{row.contacts?.name||row.contacts?.phone_number||'Customer'}</strong><p>{row.last_message_preview||row.last_message_body||conversationHandlingStatus(row).label}</p></div><RouteLink className="btn btn-wire" route={{section:'messages',resourceKind:'conversation',resourceId:row.id}} navigate={navigate}>Open</RouteLink></div>)}</ResourceState>
      </Surface>
      <Surface title="Recent campaigns" action={<RouteLink route="broadcasts" navigate={navigate}>View all →</RouteLink>}><ResourceState resource={campaigns} empty={!history.length}><div className="table-scroll"><table className="work-table"><thead><tr><th>Campaign</th><th>Status</th><th>Recorded time</th></tr></thead><tbody>{history.slice(0,4).map((item:any)=><tr key={item.id}><td><RouteLink route={{section:'broadcasts',resourceKind:'campaign',resourceId:item.id}} navigate={navigate}>{item.broadcast_name||'Untitled campaign'}</RouteLink></td><td><span className={'badge '+(item.status==='failed'?'badge-red':'badge-cream')}>{campaignStatus(item.status)}</span></td><td>{catTime(item.completed_at||item.scheduled_at||item.created_at)}</td></tr>)}</tbody></table></div><p className="surface-footnote">Processed means sending has finished. Delivery is confirmed separately.</p></ResourceState></Surface>
    </div><div>
      <PlanUsageSnapshot customer={customer} navigate={navigate}/>
      <Surface title="Zed AI" action={<RouteLink route="zoeAi" navigate={navigate}>Manage agents →</RouteLink>}><ResourceState resource={agents} empty={!agents.data?.agents?.length}>{agents.data?.agents?.slice(0,3).map((agent:any)=><RouteLink key={agent.id} className="agent-summary" route={{section:'zoeAi',resourceKind:'agent',resourceId:agent.id}} navigate={navigate}><div><strong>{agent.name||agent.assistant_name}</strong><p>{agent.knowledge?.length??0} knowledge sources</p></div><AgentBadge agent={agent}/></RouteLink>)}</ResourceState></Surface>
      <Surface title="Quick actions"><div className="action-list">{[['broadcasts','Create a campaign','Reach your audience'],['contacts','Add contacts','Import or add a customer'],['automations','Create an automation','Set up a helpful response']].map(([section,title,sub])=><RouteLink key={section} route={section==='broadcasts'?{section,resourceKind:'campaign',resourceId:'new'}:section} navigate={navigate}><div><strong>{title}</strong><p>{sub}</p></div><span>→</span></RouteLink>)}</div></Surface>
      <Surface title="Recent message activity"><ResourceState resource={messages} empty={!messageRows.length}>{messageRows.slice(0,4).map((message:any,index:number)=><div className="activity-row" key={message.id||index}><span className="status-dot good"/><div><strong>{message.direction==='inbound'?'Message received':'Outbound message'}</strong><p>{message.from_number||message.to_number}</p><small>{catTime(message.created_at)}</small></div></div>)}</ResourceState></Surface>
    </div></div>
  </div>;
}
