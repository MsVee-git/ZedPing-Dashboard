// @ts-nocheck
import { useEffect, useRef, useState } from "react";

const styles = ["professional", "friendly", "warm", "concise"];
const quotationFields = [
  { key: "product_or_service", label: "Product / service", required: true },
  { key: "quantity", label: "Quantity" },
  { key: "vehicle_make", label: "Vehicle make" },
  { key: "vehicle_model", label: "Vehicle model" },
  { key: "vehicle_year", label: "Vehicle year" }
];

function quotationAction(value) {
  if (value?.type !== "quotation") return null;
  const selected = new Set((value.qualification_fields || []).map(field => typeof field === "string" ? field : field?.key));
  selected.add("product_or_service");
  return {
    type: "quotation",
    qualification_fields: quotationFields.filter(field => selected.has(field.key)).map(field => ({ key: field.key, required: field.required === true })),
    handoff_reason: value.handoff_reason || "Quotation requested"
  };
}

export function ZoeAI({ customer, apiFetch, routeAgentId = null, onRouteOpen, onRouteUnavailable }) {
  const canManage = ["owner", "admin"].includes(String(customer?.role || "").toLowerCase());
  const [templates,setTemplates]=useState([]);
  const [agents,setAgents]=useState([]);
  const [knowledge,setKnowledge]=useState([]);
  const [numbers,setNumbers]=useState([]);
  const [draft,setDraft]=useState(null);
  const [notice,setNotice]=useState("");
  const [question,setQuestion]=useState("");
  const [messages,setMessages]=useState([]);
  const [test,setTest]=useState(null);
  const [testContactPhone,setTestContactPhone]=useState("");
  const [activationReview,setActivationReview]=useState(null);
  const [testContacts,setTestContacts]=useState([]);
  const [saving,setSaving]=useState(false);
  const [lifecycleBusy,setLifecycleBusy]=useState("");
  const [selected,setSelected]=useState(null);
  const goLivePending = useRef(false);
  const [goLiveError,setGoLiveError]=useState("");
  const updateLivePending = useRef(false);
  const [updateLiveReview,setUpdateLiveReview]=useState(false);
  const [updateLiveError,setUpdateLiveError]=useState("");

  async function load() {
    try {
      const results = await Promise.all([apiFetch("/ai-agents/library"),apiFetch("/ai-agents"),apiFetch("/ai-agents/knowledge-items"),apiFetch("/ai-agents/numbers")]);
      setTemplates((await results[0].json()).templates || []);
      const loadedAgents=(await results[1].json()).agents || [];
      setAgents(loadedAgents);
      setSelected(current=>current ? loadedAgents.find(item=>String(item.id)===String(current.id)) || current : current);
      setKnowledge((await results[2].json()).items || []);
      setNumbers((await results[3].json()).numbers || []);
      return loadedAgents;
    } catch (error) { setNotice(error?.message || "We could not load Zoe AI."); }
  }
  useEffect(() => { load(); setDraft(null); setMessages([]); setTest(null); }, [customer?.id]);

  async function loadTestContacts(agentId) {
    if (!canManage || !agentId) return;
    try { const response=await apiFetch("/ai-agents/"+agentId+"/test-contacts"); const result=await response.json(); setTestContacts(result.test_contacts || []); }
    catch (error) { setNotice(error?.message || "We could not load approved test contacts."); }
  }
  function openAgent(agent, { updateRoute = true } = {}) { if (updateRoute) onRouteOpen?.(agent?.id); setSelected(agent); setTestContacts([]); loadTestContacts(agent?.id); }
  useEffect(() => {
    if (!routeAgentId || !agents.length) return;
    const agent = agents.find((item) => String(item.id) === String(routeAgentId));
    if (!agent) { onRouteUnavailable?.(); return; }
    if (String(selected?.id) !== String(agent.id)) openAgent(agent, { updateRoute: false });
  }, [routeAgentId, agents, selected?.id]);
  function start(template, agent) {
    if (!canManage) return;
    const source=agent || {};
    setMessages([]); setTest(null); setNotice("");
    setDraft({id:source.id || null,template_key:source.template_key || template.key,assistant_name:source.name || "",communication_style:source.configuration?.communication_style || "professional",whatsapp_number_id:source.whatsapp_number_id || numbers[0]?.id || "",knowledge_item_ids:(source.knowledge || []).map(item=>item.id),handoff:{person:true,unknown:true,quote_or_buy:true,phrases:[],...(source.configuration?.handoff || {})},commercial_action:quotationAction(source.configuration?.commercial_action)});
  }
  function toggleKnowledge(id) {
    const ids=draft.knowledge_item_ids || [];
    const next=ids.includes(id) ? ids.filter(value=>value!==id) : ids.length < 5 ? ids.concat(id) : ids;
    setDraft({...draft,knowledge_item_ids:next});
  }
  async function save() {
    if (saving) return;
    setSaving(true); setNotice("");
    try {
      const path=draft.id ? "/ai-agents/"+draft.id+"/draft" : "/ai-agents/drafts";
      const response=await apiFetch(path,{method:draft.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      const result=await response.json();
      setDraft(null); openAgent(result.agent); await load(); setNotice("Draft saved. It is not active on WhatsApp.");
    } catch(error) { setNotice(error?.message || "We couldn't save your changes. Please try again."); }
    finally { setSaving(false); }
  }
  async function testAgent() {
    if (!selected || !question.trim()) return;
    const next=messages.concat([{role:"user",content:question.trim()}]).slice(-12);
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next})});
      const result=await response.json();
      setMessages(next.concat([{role:"assistant",content:result.reply}])); setTest(result); setQuestion("");
    } catch(error) { setNotice(error?.message || "We could not run this private test."); }
  }
  async function addTestContact() {
    if (!selected || !testContactPhone.trim()) return;
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/test-contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:testContactPhone})});
      const result=await response.json();
      setTestContacts(current => current.some(item=>item.id===result.test_contact?.id) ? current : current.concat(result.test_contact || [])); setNotice("Test contact added."); setTestContactPhone("");
      return result;
    } catch(error) { setNotice(error?.message || "We could not add the approved test contact."); }
  }
  async function reviewActivation() {
    if (!selected || !canManage || lifecycleBusy) return;
    setGoLiveError(""); setNotice("");
    // Going live keeps the activated snapshot. Draft readiness is only for activation.
    if (selected.lifecycle_status === "active" && selected.deployment_mode === "test") {
      setActivationReview({ assistant_name: selected.name });
      return;
    }
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/readiness");
      const result=await response.json();
      if (!result.ready) throw new Error(result.error || "This agent is not ready to activate");
      setActivationReview(result);
    } catch(error) { setNotice(error?.message || "This agent is not ready to activate."); }
  }
  async function activate() {
    if (!selected || lifecycleBusy) return;
    setLifecycleBusy("activate");
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/activate",{method:"POST"});
      const result=await response.json();
      openAgent(result.agent); setActivationReview(null); await load(); setNotice("Active on WhatsApp — Test contacts only.");
    } catch(error) { setNotice(error?.message || "We could not activate this agent."); }
    finally { setLifecycleBusy(""); }
  }
  function setQuotationEnabled(enabled) {
    if (!draft) return;
    setDraft({...draft,commercial_action:enabled ? quotationAction(draft.commercial_action) || quotationAction({type:"quotation"}) : null});
  }
  function toggleQuotationField(field) {
    if (!draft?.commercial_action || field.key === "product_or_service") return;
    const current=quotationAction(draft.commercial_action);
    const selected=new Set((current?.qualification_fields || []).map(item=>item.key));
    if (selected.has(field.key)) selected.delete(field.key); else selected.add(field.key);
    setDraft({...draft,commercial_action:{...current,qualification_fields:quotationFields.filter(item=>selected.has(item.key)).map(item=>({key:item.key,required:item.required === true}))}});
  }
  async function goLive() {
    if (!selected || !canManage || lifecycleBusy || goLivePending.current) return;
    goLivePending.current = true;
    setGoLiveError(""); setNotice("");
    setLifecycleBusy("go-live");
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/go-live",{method:"POST"});
      const result=await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to put this AI Agent live");
      if (result.agent?.id !== selected.id || result.agent?.lifecycle_status !== "active" || result.agent?.deployment_mode !== "live") throw new Error("Unable to confirm Live status. Refresh the page before trying again.");
      openAgent(result.agent); setActivationReview(null); await load(); setNotice("Live on WhatsApp — Responding to eligible customers.");
    }
    catch(error) {
      const safeMessages = ["Only an active Test Mode agent can go live", "The activated AI configuration is unavailable", "The activated AI configuration is invalid", "The activated AI configuration is not bound to this WhatsApp number", "The activated knowledge snapshot is invalid", "The activated handoff configuration is invalid", "Another active AI Agent already uses this WhatsApp number", "Select a connected WhatsApp number from this workspace", "Administrator access required", "You do not have access to this workspace", "AI Agent changed before going live; review it again", "Unable to confirm Live status. Refresh the page before trying again."];
      setGoLiveError(safeMessages.includes(error?.message) ? error.message : "We could not put this agent live. Check your connection and sign-in, then try again.");
    }
    finally { goLivePending.current = false; setLifecycleBusy(""); }
  }
  async function updateLive() {
    if (!selected || !canManage || !selected.changes_not_live_yet || lifecycleBusy || updateLivePending.current) return;
    updateLivePending.current = true;
    setUpdateLiveError(""); setNotice(""); setLifecycleBusy("update-live");
    const agentId=selected.id;
    try {
      const response=await apiFetch("/ai-agents/"+agentId+"/update-live",{method:"POST"});
      const result=await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error || "Unable to update the live agent"), { code:result.code });
      if (!result.activation?.version || !result.activation?.activated_at) throw new Error("Unable to confirm that the live version was updated.");
      let loadedAgents=await load();
      let refreshed=loadedAgents?.find(item=>String(item.id)===String(agentId));
      // A server-confirmed activation is authoritative. Retry one read before
      // treating a delayed list refresh as incomplete; do not present a real
      // activation as a failed mutation merely because reconciliation lagged.
      if (!refreshed || refreshed.changes_not_live_yet) {
        loadedAgents=await load();
        refreshed=loadedAgents?.find(item=>String(item.id)===String(agentId));
      }
      if (!refreshed || refreshed.changes_not_live_yet) {
        openAgent(result.agent || selected);
        setUpdateLiveReview(false);
        setNotice("Live version "+result.activation.version+" was activated. Refresh this page if the current version does not appear yet.");
        return;
      }
      openAgent(refreshed);
      setUpdateLiveReview(false);
      setNotice("Live version "+result.activation.version+" updated successfully.");
    } catch(error) {
      const safeMessages = ["Only an active AI Agent can update the live configuration.", "This draft has more approved knowledge sources than the current limit. Remove a source before updating Live.", "Select at least one eligible approved knowledge source before updating Live.", "One or more selected knowledge sources are no longer eligible. Review the draft before updating Live.", "Configure handoff behaviour before updating Live.", "The connected WhatsApp number is unavailable. Review the agent before updating Live.", "Another active AI Agent already uses this WhatsApp number.", "Add an approved test contact before updating this agent.", "This agent changed before the update completed. Refresh and review it again.", "Unable to confirm that the live version was updated."];
      setUpdateLiveError(safeMessages.includes(error?.message) ? error.message : "We couldn't update the live agent. Check its configuration and try again.");
    } finally { updateLivePending.current=false; setLifecycleBusy(""); }
  }
  async function returnToTest() {
    if (!selected || !window.confirm("Return "+selected.name+" to Test Mode? Only approved test contacts will receive responses.")) return;
    try { const response=await apiFetch("/ai-agents/"+selected.id+"/test-mode",{method:"POST"}); const result=await response.json(); openAgent(result.agent); await load(); setNotice("Testing on WhatsApp — Approved test contacts only."); }
    catch(error) { setNotice(error?.message || "We could not return this agent to Test Mode."); }
  }
  async function resume() {
    if (!selected || !window.confirm(selected.deployment_mode === "live" ? "Resume Live Mode? This agent may respond to eligible customers." : "Resume Test Mode? Only approved test contacts can receive responses.")) return;
    if (lifecycleBusy) return;
    setLifecycleBusy("resume");
    try { const response=await apiFetch("/ai-agents/"+selected.id+"/resume",{method:"POST"}); const result=await response.json(); openAgent(result.agent); await load(); setNotice(result.agent?.deployment_mode === "live" ? "Live on WhatsApp — Responding to eligible customers." : "Test Mode — approved test contacts only."); }
    catch(error) { setNotice(error?.message || "We could not resume this agent."); }
    finally { setLifecycleBusy(""); }
  }
  async function pause() {
    if (!selected || !window.confirm("Pause "+selected.name+"? The assistant will stop responding to new eligible WhatsApp messages.")) return;
    if (lifecycleBusy) return;
    setLifecycleBusy("pause");
    try {
      const response=await apiFetch("/ai-agents/"+selected.id+"/pause",{method:"POST"});
      const result=await response.json(); openAgent(result.agent); await load(); setNotice("Agent paused. Existing conversations remain in Team Inbox.");
    } catch(error) { setNotice(error?.message || "We could not pause this agent."); }
    finally { setLifecycleBusy(""); }
  }
  async function removeTestContact(contact) {
    if (!selected || !contact || !window.confirm("Remove this approved test contact?")) return;
    try { await apiFetch("/ai-agents/"+selected.id+"/test-contacts/"+contact.id,{method:"DELETE"}); setTestContacts(current=>current.filter(item=>item.id!==contact.id)); setNotice("Approved test contact removed."); }
    catch(error) { setNotice(error?.message || "We could not remove this approved test contact."); }
  }
  async function archive() {
    if (!selected || !window.confirm("Archive this draft AI Agent?")) return;
    try { await apiFetch("/ai-agents/"+selected.id+"/archive",{method:"POST"}); setSelected(null); await load(); } catch(error) { setNotice(error?.message || "Unable to archive this draft."); }
  }

  if (draft) {
    const current=templates.find(item=>item.key===draft.template_key);
    const commercialAction=quotationAction(draft.commercial_action);
    return <div style={{padding:"28px 32px",maxWidth:1000,margin:"0 auto"}}><h1 className="editorial" style={{fontSize:42}}>Zoe AI</h1><p style={{color:"var(--cream2)"}}>Configure a private draft. It will not respond on WhatsApp.</p>{notice && <p role="status">{notice}</p>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:20}}><div style={{padding:20,border:"1px solid var(--wire)",background:"var(--panel)"}}>
      <label className="label">Agent template</label><select className="input" value={draft.template_key} onChange={e=>setDraft({...draft,template_key:e.target.value})}>{templates.map(item=><option key={item.key} value={item.key}>{item.title}</option>)}</select>
      <label className="label" style={{marginTop:16}}>What should customers call your assistant?</label><input className="input" value={draft.assistant_name} onChange={e=>setDraft({...draft,assistant_name:e.target.value})} placeholder="For example: AutoGuard Assistant"/>
      <label className="label" style={{marginTop:16}}>Communication style</label><select className="input" value={draft.communication_style} onChange={e=>setDraft({...draft,communication_style:e.target.value})}>{styles.map(value=><option key={value}>{value}</option>)}</select>
      <label className="label" style={{marginTop:16}}>Future connected WhatsApp number</label><select className="input" value={draft.whatsapp_number_id} onChange={e=>setDraft({...draft,whatsapp_number_id:e.target.value})}>{numbers.map(item=><option key={item.id} value={item.id}>{item.phone_number}</option>)}</select>
      <label className="label" style={{marginTop:16}}>Approved knowledge (up to 5)</label>{knowledge.length ? knowledge.map(item=><label key={item.id} style={{display:"block",padding:"7px 0"}}><input type="checkbox" checked={draft.knowledge_item_ids.includes(item.id)} onChange={()=>toggleKnowledge(item.id)}/> {item.name} · {item.source_type === "image" ? "Image" : "Text"}</label>) : <p style={{color:"var(--mist)"}}>No eligible approved knowledge yet. Review and approve an Image extraction in Content Library before selecting it here.</p>}
      <label className="label" style={{marginTop:16}}>Handoff behaviour</label>{[["person","Customer asks for a person"],["unknown","No approved answer"]].map(([key,label])=><label key={key} style={{display:"block",padding:"5px 0"}}><input type="checkbox" checked={draft.handoff[key]!==false} onChange={e=>setDraft({...draft,handoff:{...draft.handoff,[key]:e.target.checked}})}/> {label}</label>)}
      <section aria-label="Commercial actions" style={{marginTop:20,padding:14,border:"1px solid var(--wire)",background:"var(--panel2)"}}><label className="label">Commercial actions</label><p style={{margin:"6px 0 10px",color:"var(--cream2)"}}>Zoe can recognise when a customer wants to proceed or requests a quotation, collect the details you choose conversationally, then send the conversation to your team.</p><label style={{display:"block",padding:"5px 0"}}><input aria-label="Handle quotation requests" type="checkbox" checked={!!commercialAction} onChange={e=>setQuotationEnabled(e.target.checked)}/> Handle quotation requests</label>{commercialAction && <div style={{marginTop:12}}><p><strong>Action type:</strong> Quotation</p><label className="label" style={{marginTop:12}}>Qualification fields</label>{quotationFields.map(field=>{const selected=(commercialAction.qualification_fields || []).some(item=>item.key===field.key); return <label key={field.key} style={{display:"block",padding:"5px 0"}}><input aria-label={`Qualification field: ${field.label}`} type="checkbox" checked={selected} disabled={field.required} onChange={()=>toggleQuotationField(field)}/> {field.label}{field.required ? " (required)" : " (optional)"}</label>})}<label className="label" style={{marginTop:12}}>Team Inbox handoff reason</label><input aria-label="Quotation handoff reason" className="input" value={commercialAction.handoff_reason} maxLength={120} onChange={e=>setDraft({...draft,commercial_action:{...commercialAction,handoff_reason:e.target.value}})}/></div>}</section>
      <p style={{marginTop:12,color:"var(--gold2)"}}>Saving changes updates the draft. It does not change the Live agent until Update Live Agent is used.</p>
      <button className="btn btn-gold" style={{marginTop:20}} disabled={saving || !draft.assistant_name || !draft.whatsapp_number_id} onClick={save}>{saving ? "Saving…" : "Save draft"}</button> <button className="btn btn-wire" onClick={()=>setDraft(null)}>Back</button></div>
      <aside style={{padding:20,border:"1px solid var(--wire)",background:"var(--panel)"}}><div className="mono">REVIEW</div><h2 className="editorial" style={{fontSize:30,marginTop:10}}>{draft.assistant_name || "Your assistant"}</h2><p style={{marginTop:10}}>{current?.role}</p><p style={{marginTop:14}}><strong>Can help with:</strong> {current?.can}</p><p><strong>Hands to the team:</strong> {current?.handoff}</p><p><strong>Cannot do:</strong> {current?.unavailable}</p><p style={{color:"var(--gold2)",marginTop:16}}>Status: Draft — not active on WhatsApp.</p></aside></div></div>;
  }
  if (selected) {
    const label = selected.lifecycle_status === "active" ? (selected.deployment_mode === "live" ? "Live — responding to eligible WhatsApp customers." : "Test Mode — responding only to approved test contacts.") : selected.lifecycle_status === "paused" ? "Paused — not responding on WhatsApp." : "Draft — not active on WhatsApp.";
    const changesNotLiveYet = selected.lifecycle_status === "active" && selected.changes_not_live_yet === true;
    const lifecycleAction = selected.lifecycle_status === "active" ? (selected.deployment_mode === "test" ? <button className="btn btn-wire" disabled={!!lifecycleBusy} onClick={reviewActivation}>Go Live</button> : <button className="btn btn-wire" disabled={!!lifecycleBusy} onClick={returnToTest}>Return to Test Mode</button>) : selected.lifecycle_status === "paused" ? <button className="btn btn-gold" disabled={!!lifecycleBusy} onClick={resume}>{lifecycleBusy === "resume" ? "Resuming…" : `Resume ${selected.deployment_mode === "live" ? "Live" : "Test Mode"}`}</button> : <button className="btn btn-gold" disabled={!testContacts.length || !!lifecycleBusy} onClick={reviewActivation}>Activate Agent</button>;
    return <div style={{padding:"28px 32px",maxWidth:1000,margin:"0 auto"}}>{activationReview && <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,.65)",display:"grid",placeItems:"center",padding:20}}><div style={{maxWidth:560,padding:24,border:"1px solid var(--wire)",background:"var(--panel)"}}><h2 className="editorial" style={{fontSize:30}}>{selected?.lifecycle_status === "active" ? `Go Live with ${activationReview.assistant_name}?` : `Activate ${activationReview.assistant_name}?`}</h2><p>{selected?.lifecycle_status === "active" ? "Once live, this assistant can respond to eligible incoming WhatsApp messages using the activated approved information." : "Once activated, this assistant responds only to approved test contacts."}</p>{goLiveError && <p role="alert" style={{color:"var(--error-text)",margin:"12px 0"}}>{goLiveError}</p>}<button className="btn btn-gold" disabled={!!lifecycleBusy} onClick={selected?.lifecycle_status === "active" ? goLive : activate}>{lifecycleBusy ? "Saving…" : selected?.lifecycle_status === "active" ? "Go Live" : "Activate Agent"}</button> <button className="btn btn-wire" disabled={!!lifecycleBusy} onClick={()=>setActivationReview(null)}>Cancel</button></div></div>}{updateLiveReview && <div role="dialog" aria-modal="true" aria-label="Update Live Agent" style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,.65)",display:"grid",placeItems:"center",padding:20}}><div style={{maxWidth:560,padding:24,border:"1px solid var(--wire)",background:"var(--panel)"}}><h2 className="editorial" style={{fontSize:30}}>Update Live Agent?</h2><p>Your draft changes will become a new live version. The current live version remains active unless this update succeeds.</p>{updateLiveError && <p role="alert" style={{color:"var(--error-text)",margin:"12px 0"}}>{updateLiveError}</p>}<button className="btn btn-gold" disabled={!!lifecycleBusy} onClick={updateLive}>{lifecycleBusy === "update-live" ? "Updating…" : "Update Live Agent"}</button> <button className="btn btn-wire" disabled={!!lifecycleBusy} onClick={()=>setUpdateLiveReview(false)}>Cancel</button></div></div>}<h1 className="editorial" style={{fontSize:42}}>{selected.name}</h1><p style={{color:"var(--gold2)"}}>{label}</p>{changesNotLiveYet && <section role="status" style={{marginTop:12,padding:14,border:"1px solid var(--gold2)",background:"var(--panel)"}}><strong>Changes not live yet</strong><p style={{marginTop:6}}>Live version {selected.activated_configuration_version || "—"}. Update the live agent to apply your draft changes.</p></section>}{notice && <p role="status">{notice}</p>}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:20}}><div style={{padding:20,border:"1px solid var(--wire)",background:"var(--panel)"}}><p><strong>Knowledge sources:</strong> {selected.knowledge?.length ? selected.knowledge.map(item=>item.name).join(", ") : "None selected"}</p>{canManage && selected.lifecycle_status !== "active" && <><label className="label" style={{marginTop:16}}>Approved test contacts</label>{testContacts.length ? testContacts.map(contact=><div key={contact.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0"}}><span>{contact.phone_e164}</span><button className="btn btn-wire" onClick={()=>removeTestContact(contact)}>Remove</button></div>) : <p style={{color:"var(--mist)"}}>No approved test contacts yet.</p>}<input className="input" value={testContactPhone} onChange={e=>setTestContactPhone(e.target.value)} placeholder="+260…"/><button className="btn btn-wire" onClick={addTestContact}>Add test contact</button></>}{canManage && <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>{selected.lifecycle_status === "active" && <button className="btn btn-gold" disabled={!!lifecycleBusy} onClick={pause}>{lifecycleBusy === "pause" ? "Pausing…" : "Pause Agent"}</button>}{changesNotLiveYet && <button className="btn btn-gold" disabled={!!lifecycleBusy} onClick={()=>{ setUpdateLiveError(""); setUpdateLiveReview(true); }}>Update Live Agent</button>}{lifecycleAction}<button className="btn btn-wire" onClick={()=>start({},selected)}>Edit draft</button><button className="btn btn-wire" onClick={archive}>Archive</button></div>}<button className="btn btn-wire" onClick={()=>setSelected(null)}>Back</button></div><div style={{padding:20,border:"1px solid var(--wire)",background:"var(--panel)"}}><div className="mono">PRIVATE TEST AGENT</div>{messages.map((entry,index)=><p key={index}><strong>{entry.role==="user"?"You":selected.name}:</strong> {entry.content}</p>)}{canManage && <><textarea className="textarea" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask a customer question…"/><button className="btn btn-gold" onClick={testAgent}>Test Agent</button></>}</div></div></div>;
  }
  return <div style={{padding:"28px 32px",maxWidth:1180,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div className="mono" style={{color:"var(--gold2)"}}>ZOE AI</div><h1 className="editorial" style={{fontSize:42}}>AI Agents</h1><p style={{color:"var(--cream2)"}}>Create private draft assistants from selected approved knowledge.</p></div>{canManage && <button className="btn btn-gold" onClick={()=>start(templates[0]||{key:"common_questions"})}>Create AI Agent</button>}</div>{notice && <p role="status">{notice}</p>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginTop:22}}>{templates.map(item=><div key={item.key} style={{padding:18,border:"1px solid var(--wire)",background:"var(--panel)"}}><h2 className="editorial" style={{fontSize:26}}>{item.title}</h2><p>{item.role}</p><p style={{color:"var(--mist)"}}>Hands to a person: {item.handoff}</p>{canManage && <button className="btn btn-gold" onClick={()=>start(item)}>Use template</button>}</div>)}</div><h2 className="editorial" style={{fontSize:32,marginTop:28}}>My Agents</h2>{agents.map(agent=><button key={agent.id} className="slink" onClick={()=>openAgent(agent)}>{agent.name} · {agent.lifecycle_status} · {agent.knowledge?.length || 0} approved knowledge item(s)</button>)}</div>;
}

