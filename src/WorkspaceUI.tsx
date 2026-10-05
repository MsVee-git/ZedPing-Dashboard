import { useEffect, useState } from 'react';
import { routeToPath } from './lib/dashboardRouting';

export const navigation = [
  { label:'Workspace', items:[['overview','Overview','home'],['messages','Team Inbox','messages'],['contacts','Contacts','contacts'],['broadcasts','Campaigns','broadcast']] },
  { label:'Build', items:[['automations','Automations','flow'],['zoeAi','Zed AI','auto'],['content','Content Library','catalog']] },
  { label:'Manage', items:[['whatsapp','WhatsApp','messages'],['analytics','Analytics','chart'],['settings','Settings','settings']] }
];
export function parentSection(section: string) {
  return ({contactGroups:'contacts', chatbotFlows:'automations', templates:'whatsapp',team:'settings',billing:'settings',integrations:'settings'})[section] || section;
}
export function RouteLink({ route, navigate, children, className='', ...props }: any) {
  return <a {...props} className={className} href={routeToPath(typeof route === 'string' ? {section:route} : route)} onClick={event=>{
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(route);
  }}>{children}</a>;
}
export function SectionTabs({route,navigate}: any) {
  const parent=parentSection(route.section);
  const items = parent==='contacts' ? [['contacts','All contacts'],['contactGroups','Groups & segments']]
    : parent==='automations' ? [[{section:'automations'},'Library'],[{section:'automations',tab:'keywords'},'Active automations'],['chatbotFlows','Chatbot flows']]
    : parent==='whatsapp' ? [['whatsapp','Numbers & connection'],['templates','Templates']]
    : parent==='settings' ? [['settings','Business profile'],['team','Team'],['integrations','Integrations'],['billing','Billing']]
    : parent==='analytics' ? ['messaging','campaigns','conversations','automations','ai'].map(tab=>[{section:'analytics',tab:tab==='messaging'?undefined:tab},tab==='ai'?'Zed AI':tab.charAt(0).toUpperCase()+tab.slice(1)]) : [];
  if(!items.length)return null;
  return <nav className="section-tabs" aria-label={parent+' pages'}>{items.map(([target,label]:any)=>{
    const value=typeof target==='string'?{section:target}:target;
    const active=route.section===value.section && route.tab===value.tab;
    return <RouteLink key={label} route={target} navigate={navigate} aria-current={active?'page':undefined} className={active?'selected':''}>{label}</RouteLink>;
  })}</nav>;
}
export function useResource(request: any, path: string, workspaceId: string) {
  const [state,setState]=useState<any>({data:null,loading:true,error:''});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let current=true;
    const controller=new AbortController();
    setState({data:null,loading:true,error:''});
    request(path,{signal:controller.signal}).then(async(response:Response)=>{
      if(!response.ok)throw new Error('Unable to load this information.');
      const data=await response.json();
      if(current)setState({data,loading:false,error:''});
    }).catch((error:Error)=>{if(current)setState({data:null,loading:false,error:error.message});});
    return()=>{current=false;controller.abort();};
  },[request,path,workspaceId,revision]);
  return {...state,retry:()=>setRevision(value=>value+1)};
}
export function ResourceState({resource,empty,children}:any) {
  if(resource.loading)return <p className="surface-message" role="status">Loading…</p>;
  if(resource.error)return <div className="surface-message" role="alert"><p>{resource.error}</p><button className="btn btn-wire" onClick={resource.retry}>Try again</button></div>;
  if(empty)return <p className="surface-message">No activity yet. New activity will appear here.</p>;
  return children;
}
export function Surface({title,action,children,className=''}:any){return <section className={'work-surface '+className}><header><h2>{title}</h2>{action}</header>{children}</section>;}
export function PageTitle({title,description,action}:any){return <header className="page-heading"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>;}
export function AgentBadge({agent}:any){
  const status=agent.lifecycle_status==='active' ? (agent.deployment_mode==='live'?'Live':'Test') : agent.lifecycle_status==='paused'?'Paused':'Draft';
  return <span className={'badge '+(status==='Live'?'badge-green':status==='Test'?'badge-gold':'badge-cream')}>{status}</span>;
}
