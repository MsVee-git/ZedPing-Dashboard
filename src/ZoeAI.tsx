// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

const styles = ["professional", "friendly", "warm", "concise"];

export function ZoeAI({ customer, apiFetch }) {
  const canManage = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [testMessages, setTestMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const empty = { template_key:"common_questions", assistant_name:"", communication_style:"professional", whatsapp_number_id:"", knowledge_item_ids:[], handoff:{person:true,unknown:true,quote_or_buy:true,phrases:[]} };

  const load = async () => {
    try {
      const [library, agentResult, knowledgeResult, numberResult] = await Promise.all([
        apiFetch("/ai-agents/library"), apiFetch("/ai-agents"), apiFetch("/ai-agents/knowledge-items"), apiFetch("/ai-agents/numbers")
      ]);
      setTemplates((await library.json()).templates || []);
      setAgents((await agentResult.json()).agents || []);
      const itemResult = await knowledgeResult.json(); setKnowledge(itemResult.items || []);
      setNumbers((await numberResult.json()).numbers || []);
    } catch (error) { setNotice(error?.message || "We could not load Zoe AI."); }
  };
  useEffect(() => { load(); setSelected(null); setEditing(null); setTestMessages([]); setTestResult(null); }, [customer?.id]);

  const form = editing?.form || empty;
  const update = (patch) => setEditing(current => ({ ...current, form:{ ...current.form, ...patch } }));
  const selectKnowledge = (id) => {
    const ids = form.knowledge_item_ids || [];
    update({ knowledge_item_ids: ids.includes(id) ? ids.filter(item => item !== id) : ids.length < 5 ? [...ids,id] : ids });
  };
  const openCreate = (template) => {
    if (!canManage) return;
    setSelected(null); setTestMessages([]); setTestResult(null);
    setEditing({ id:null, form:{ ...empty, template_key:template.key, whatsapp_number_id:numbers[0]?.id || "" } });
  };
  const openEdit = (agent) => {
    if (!canManage || agent.lifecycle_status !== "draft") return;
    setSelected(agent); setTestMessages([]); setTestResult(null);
    setEditing({ id:agent.id, form:{ ...empty, template_key:agent.template_key || "common_questions", assistant_name:agent.name || "", communication_style:agent.configuration?.communication_style || "professional", whatsapp_number_id:agent.whatsapp_number_id || "", knowledge_item_ids:(agent.knowledge || []).map(item => item.id), handoff:{ ...empty.handoff, ...(agent.configuration?.handoff || {}) } } });
  };
  const save = async () => {
    setSaving(true); setNotice("");
    try {
      const response = await apiFetch(editing.id ? "/ai-agents/" + editing.id + "/draft" : "/ai-agents/drafts", { method:editing.id ? "PATCH" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      const result = await response.json();
      await load(); setSelected(result.agent); setEditing(null); setNotice("Draft saved. It is not active on WhatsApp.");
    } catch (error) { setNotice(error?.message || "We could not save this draft."); } finally { setSaving(false); }
  };
  const runTest = async () => {
    const text = question.trim(); if (!text || !selected?.id) return;
    const next = [...testMessages, {role:"user",content:text}].slice(-12);
    setTesting(true); setNotice(""); setQuestion("");
    try {
      const response = await apiFetch("/ai-agents/" + selected.id + "/test", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next})});
      const result=await response.json();
      setTestMessages([...next,{role:"assistant",content:result.reply}]); setTestResult(result);
    } catch(error) { setNotice(error?.message || "We could not run this private test."); } finally { setTesting(false); }
  };
  const archive = async () => {
    if (!selected?.id || !window.confirm("Archive this draft AI Agent?")) return;
    try { await apiFetch("/ai-agents/" + selected.id + "/archive",{method:"POST"}); await load(); setSelected(null); setNotice("Draft archived."); } catch(error){setNotice(error?.message || "Unable to archive draft.");}
  };
  const template = templates.find(item => item.key === form.template_key);
  const selectedNumber = numbers.find(item => item.id === (selected?.whatsapp_number_id || form.whatsapp_number_id));
  const headline = selected ? selected.name : "AI Agents";

  return <div style={{padding:"28px 32px",maxWidth:1180,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,marginBottom:26}}>
      <div><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:2}}>ZOE AI</div><h1 className="editorial" style={{fontSize:42,marginTop:4}}>{headline}</h1><p style={{color:"var(--cream2)",maxWidth:670,marginTop:8}}>Create a private draft assistant from approved business information. Zoe AI is not active on WhatsApp yet.</p></div>
      {canManage && !editing && <button className="btn btn-gold" onClick={() => openCreate(templates[0] || {key:"common_questions"})}>Create AI Agent</button>}
    </div>
    {notice && <div role="status" style={{marginBottom:16,padding:"11px 13px",border:"1px solid var(--wire2)",color:"var(--cream2)"}}>{notice}</div>}
    {!canManage && <div style={{marginBottom:20,padding:14,border:"1px solid var(--wire)",color:"var(--cream2)"}}>You can view AI Agent drafts, but only an owner or admin can create, edit, test or archive them.</div>}

    {editing ? <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.1fr) minmax(300px,.9fr)",gap:18}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--wire)",padding:22}}>
        <div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.5}}>CONFIGURE DRAFT</div>
        <label className="label" style={{marginTop:20}}>What would you like your assistant to help with?</label>
        <select className="input" value={form.template_key} onChange={e=>update({template_key:e.target.value})}>{templates.map(item=><option key={item.key} value={item.key}>{item.title}</option>)}</select>
        <label className="label" style={{marginTop:16}}>What should customers call your assistant?</label>
        <input className="input" value={form.assistant_name} onChange={e=>update({assistant_name:e.target.value})} placeholder="For example: AutoGuard Assistant" maxLength={160}/>
        <label className="label" style={{marginTop:16}}>Communication style</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{styles.map(style=><button key={style} className={"btn "+(form.communication_style===style?"btn-gold":"btn-wire")} onClick={()=>update({communication_style:style})}>{style}</button>)}</div>
        <label className="label" style={{marginTop:16}}>Connected WhatsApp number for a future phase</label>
        <select className="input" value={form.whatsapp_number_id} onChange={e=>update({whatsapp_number_id:e.target.value})}><option value="">Select connected number</option>{numbers.map(item=><option key={item.id} value={item.id}>{item.phone_number}</option>)}</select>
        <p style={{fontSize:12,color:"var(--mist)",marginTop:7}}>Selecting a number does not activate routing or send messages.</p>
        <label className="label" style={{marginTop:18}}>Approved Text knowledge (up to 5)</label>
        {!knowledge.length ? <div style={{padding:12,border:"1px solid var(--wire)",color:"var(--mist)"}}>No active Text items are available. Add Text to Content Library first. Documents and links are coming soon for Zoe AI.</div> : knowledge.map(item=><label key={item.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid var(--wire)",cursor:"pointer"}}><input type="checkbox" checked={(form.knowledge_item_ids||[]).includes(item.id)} onChange={()=>selectKnowledge(item.id)}/><span>{item.name}<small style={{display:"block",color:"var(--mist)"}}>{item.description || "Approved Text knowledge"}</small></span></label>)}
        <label className="label" style={{marginTop:18}}>Send conversations to my team when</label>
        {[["person","A customer asks to speak to a person"],["unknown","Approved information does not answer the question"],["quote_or_buy","A customer requests a quote or appears ready to buy"]].map(([key,label])=><label key={key} style={{display:"block",margin:"9px 0",color:"var(--cream2)"}}><input type="checkbox" checked={form.handoff[key] !== false} onChange={e=>update({handoff:{...form.handoff,[key]:e.target.checked}})}/> {label}</label>)}
        <label className="label" style={{marginTop:14}}>Optional escalation phrases (one per line)</label>
        <textarea className="textarea" value={(form.handoff.phrases||[]).join("\n")} onChange={e=>update({handoff:{...form.handoff,phrases:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,5)}})} placeholder="For example: complaint"/>
        <div style={{display:"flex",gap:10,marginTop:22}}><button className="btn btn-gold" disabled={saving || !form.assistant_name || !form.whatsapp_number_id} onClick={save}>{saving?"Saving…":"Save draft"}</button><button className="btn btn-wire" onClick={()=>setEditing(null)}>Back</button></div>
      </div>
      <aside style={{background:"var(--panel)",border:"1px solid var(--wire)",padding:22,alignSelf:"start"}}><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.5}}>REVIEW</div><h2 className="editorial" style={{fontSize:29,marginTop:8}}>{form.assistant_name || "Your assistant"}</h2><p style={{color:"var(--cream2)",marginTop:10}}>{template?.role}</p><div style={{marginTop:18,fontSize:13,lineHeight:1.6}}><strong>Can help with</strong><br/>{template?.can}<br/><br/><strong>Hands to your team</strong><br/>{template?.handoff}<br/><br/><strong>Cannot do</strong><br/>{template?.unavailable}</div><div style={{marginTop:20,padding:12,border:"1px solid var(--wire2)",color:"var(--gold2)"}}>Status: Draft — not active on WhatsApp.</div></aside>
    </section> : selected ? <section style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(320px,.8fr)",gap:18}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--wire)",padding:22}}><div className="badge badge-gold">Draft</div><h2 className="editorial" style={{fontSize:34,marginTop:10}}>{selected.name}</h2><p style={{color:"var(--cream2)",marginTop:8}}>{templates.find(item=>item.key===selected.template_key)?.role}</p><div style={{marginTop:20,fontSize:13,lineHeight:1.7}}><strong>Future connected number</strong><br/>{selectedNumber?.phone_number || "Not selected"}<br/><br/><strong>Knowledge sources</strong><br/>{selected.knowledge?.length ? selected.knowledge.map(item=>item.name).join(", ") : "No approved Text knowledge selected"}<br/><br/><strong>Style</strong><br/>{selected.configuration?.communication_style || "Professional"}<br/><br/><strong>Handoff</strong><br/>The team will be suggested for person, unknown-information and configured commercial requests.</div><p style={{marginTop:20,color:"var(--gold2)"}}>This assistant remains a draft. It will not respond to live WhatsApp messages in this phase.</p><div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>{canManage && <><button className="btn btn-gold" onClick={()=>openEdit(selected)}>Edit draft</button><button className="btn btn-wire" onClick={archive}>Archive</button></>}<button className="btn btn-wire" onClick={()=>setSelected(null)}>Back to My Agents</button></div></div>
      <div style={{background:"var(--panel)",border:"1px solid var(--wire)",padding:22}}><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.5}}>PRIVATE TEST AGENT</div>{canManage ? <><div style={{minHeight:220,maxHeight:390,overflowY:"auto",marginTop:14}}>{!testMessages.length && <p style={{color:"var(--mist)"}}>Ask a realistic customer question. This is private: it does not send WhatsApp messages or change customer records.</p>}{testMessages.map((message,index)=><div key={index} style={{margin:"10px 0",padding:10,background:message.role==="user"?"rgba(184,146,42,.08)":"rgba(255,255,255,.03)"}}><strong>{message.role==="user"?"You":selected.name}</strong><br/>{message.content}</div>)}</div>{testResult && <div style={{fontSize:12,color:"var(--cream2)",padding:10,border:"1px solid var(--wire)"}}>{testResult.no_approved_knowledge ? "No approved knowledge matched" : "Knowledge used: " + (testResult.knowledge_used||[]).join(", ")}<br/>{testResult.would_handoff ? "Would hand to team" : "Would continue privately"}</div>}<textarea className="textarea" style={{marginTop:12,minHeight:70}} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type a customer question…" maxLength={2000}/><div style={{display:"flex",gap:10,marginTop:10}}><button className="btn btn-gold" disabled={testing || !question.trim()} onClick={runTest}>{testing?"Testing…":"Test Agent"}</button><button className="btn btn-wire" onClick={()=>{setTestMessages([]);setTestResult(null)}}>New test</button></div></> : <p style={{color:"var(--mist)",marginTop:14}}>Only owners and admins can run private tests.</p>}</div>
    </section> : <><section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>{templates.map(item=><article key={item.key} style={{padding:18,border:"1px solid var(--wire)",background:"var(--panel)"}}><h2 className="editorial" style={{fontSize:26}}>{item.title}</h2><p style={{color:"var(--cream2)",fontSize:13,lineHeight:1.5,marginTop:8}}>{item.role}</p><p style={{fontSize:12,color:"var(--mist)",marginTop:12}}>Hands to a person: {item.handoff}</p><p style={{fontSize:12,color:"var(--mist)",marginTop:6}}>Not available: {item.unavailable}</p>{canManage && <button className="btn btn-gold" style={{marginTop:16}} onClick={()=>openCreate(item)}>Use template</button>}</article>)}</section><section style={{marginTop:28}}><div className="mono" style={{fontSize:10,color:"var(--gold2)",letterSpacing:1.5}}>MY AGENTS</div><div style={{marginTop:12,border:"1px solid var(--wire)"}}>{!agents.length ? <p style={{padding:18,color:"var(--mist)"}}>No AI Agent drafts yet.</p> : agents.map(agent=><button key={agent.id} onClick={()=>setSelected(agent)} style={{display:"block",width:"100%",textAlign:"left",padding:16,background:"transparent",border:"none",borderBottom:"1px solid var(--wire)",color:"var(--cream)",cursor:"pointer"}}><strong>{agent.name}</strong> <span className="badge badge-gold" style={{marginLeft:8}}>{agent.lifecycle_status}</span><small style={{display:"block",color:"var(--mist)",marginTop:5}}>{agent.knowledge?.length || 0} selected Text knowledge item(s) · not active on WhatsApp</small></button>)}</div></section></>}
  </div>;
}
