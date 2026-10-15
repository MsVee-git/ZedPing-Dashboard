import { useEffect, useRef, useState } from 'react';
import './inboxCopilot.css';

export function InboxCopilot({ workspaceId, conversationId, request, onOpen, onUseDraft, canUseDraft, hasDraft }: any) {
  const [access,setAccess] = useState<any>(null);
  const [result,setResult] = useState<any>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [expanded,setExpanded] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    lock.current=false; setBusy(false); setAccess(null); setResult(null); setError('');
    request('/inbox-copilot/access').then(async (response:Response) => {
      const data=await response.json();
      if(current !== generation.current)return;
      if(!response.ok)throw new Error(data.error || 'Unable to load copilot access');
      setAccess(data);
    }).catch((failure:Error) => {if(current===generation.current)setError(failure.message);});
    return () => {generation.current++;};
  },[workspaceId,conversationId,request]);
  async function run(mode:string) {
    if(lock.current)return;
    lock.current=true; setBusy(true); setError(''); setResult(null); setExpanded(true);
    const current=generation.current;
    try {
      const response=await request('/inbox-copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,conversation_id:mode==='summary'?undefined:conversationId})});
      const data=await response.json();
      if(current!==generation.current)return;
      if(!response.ok)throw new Error(data.error || 'Copilot could not complete this request');
      setResult(data);
    } catch(failure:any) {if(current===generation.current)setError(failure.message);}
    finally {if(current===generation.current){lock.current=false;setBusy(false);}}
  }
  return <section className="inbox-copilot" aria-label="ZedPing Ai Copilot">
    <div className="copilot-heading"><div><strong>ZedPing Ai Copilot</strong><p>Summaries, lead insights and replies for your review.</p></div><button type="button" className="btn btn-wire" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Hide copilot':'Open copilot'}</button></div>
    {expanded && <>
      {!access && !error && <p role="status">Checking access…</p>}
      {access && !access.enabled && <p>Available on Business and Pro. Ask your workspace administrator about upgrading.</p>}
      {access?.enabled && <><div className="copilot-actions"><button type="button" className="btn btn-wire" disabled={busy} onClick={()=>run('summary')}>Summarise open inbox</button><button type="button" className="btn btn-wire" disabled={busy||!conversationId} onClick={()=>run('classify')}>Classify selected lead</button><button type="button" className="btn btn-wire" disabled={busy||!conversationId} onClick={()=>run('draft')}>Suggest a reply</button></div><p className="copilot-note">Pilot: up to {access.monthly_limit} copilot requests per workspace each calendar month. Requests are separate from WhatsApp messages. Suggestions do not change leads or send replies.</p></>}
      {busy && <p role="status">Reviewing recent text messages…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <div aria-live="polite"><p>{result.overview}</p><p className="copilot-note">Reviewed {result.reviewed} conversation{result.reviewed===1?'':'s'}. {result.scope} {result.usage?.remaining != null && `${result.usage.remaining} pilot requests remaining.`}</p>
        {result.items.map((item:any)=><article className="copilot-result" key={item.conversation_id}><button className="text-button" type="button" onClick={()=>onOpen(item.conversation_id)}>{item.name} → Open conversation</button><p>{item.summary}</p>{result.mode==='classify' && <><strong>Suggested stage: {item.stage.replaceAll('_',' ')}</strong><p>{item.interest}</p><p>{item.reason}</p></>}{item.next_step && <p><strong>Suggested next step:</strong> {item.next_step}</p>}{item.draft && <><p className="copilot-draft">{item.draft}</p><button className="btn btn-wire" type="button" disabled={!canUseDraft||hasDraft||item.conversation_id!==conversationId} onClick={()=>{onUseDraft(item.draft);setResult(null);}}>Use draft in reply box</button>{hasDraft && <p className="copilot-note">You already have a reply draft. Save or clear it before inserting this suggestion.</p>}{!canUseDraft && <p className="copilot-note">Take this conversation before using the draft. Review all facts before sending.</p>}</>}</article>)}
      </div>}
    </>}
  </section>;
}
