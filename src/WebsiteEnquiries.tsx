import { useState } from 'react';
import { Surface, ResourceState, useResource } from './WorkspaceUI';

export function WebsiteEnquiries({customer,request}:any) {
  const [page,setPage]=useState(0);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const resource=useResource(request,`/workspace/website-enquiries?page=${page}`,customer.id);
  const leads=resource.data?.leads||[];
  async function update(id:string,status:string){
    if(busy)return;
    setBusy(id);setError('');
    try{const response=await request(`/workspace/website-enquiries/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!response.ok)throw new Error('Could not update the enquiry.');resource.retry();}
    catch{setError('Could not update the enquiry. Please try again.');}finally{setBusy('');}
  }
  return <Surface title="Website enquiries" action={<button type="button" className="btn btn-wire" onClick={resource.retry}>Refresh enquiries</button>}>
    <p className="surface-footnote">Demo requests and sales enquiries from zedping.app. Contact details are provided for follow-up on the enquiry.</p>
    {error&&<p role="alert">{error}</p>}
    <ResourceState resource={resource} empty={!leads.length}>
      {leads.map((lead:any)=><article key={lead.id} style={{padding:20,borderTop:'1px solid var(--wire)',fontSize:16,lineHeight:1.6}}>
        <strong>{lead.business_name}</strong><div>{lead.name} · {lead.interest}</div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap'}}><a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noreferrer">+{lead.phone}</a>{lead.email&&<a href={`mailto:${lead.email}`}>{lead.email}</a>}</div>
        {lead.message&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{lead.message}</p>}
        <small>{new Date(lead.created_at).toLocaleString('en-GB',{timeZone:'Africa/Lusaka'})} CAT{lead.utm_source?` · Source: ${lead.utm_source}`:''}</small>
        <label style={{display:'block',marginTop:8}}>Follow-up status <select className="input" value={lead.status} disabled={!!busy} onChange={event=>update(lead.id,event.target.value)} style={{maxWidth:240}}>{['new','contacted','qualified','closed'].map(status=><option key={status} value={status}>{status.charAt(0).toUpperCase()+status.slice(1)}</option>)}</select></label>
      </article>)}
    </ResourceState>
    <div style={{padding:20,display:'flex',alignItems:'center',gap:12}}><button type="button" className="btn btn-wire" disabled={page===0||resource.loading} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page+1}</span><button type="button" className="btn btn-wire" disabled={!resource.data?.has_more||resource.loading} onClick={()=>setPage(value=>value+1)}>Next</button></div>
  </Surface>;
}
