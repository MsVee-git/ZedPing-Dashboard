// @ts-nocheck
import { useEffect, useMemo, useState } from "react"

const fieldTypes = [
  ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["text", "Text"],
  ["number", "Number"], ["date", "Date"], ["choice", "Choice"]
]

const recipes = [
  { id: "lead_qualification", title: "Lead Qualification", industries: ["professional", "services", "automotive", "manufacturing", "food"], description: "Ask a few questions and send promising enquiries to your team.", build: () => ({
    entry_step_key: "welcome", steps: [
      { id: "welcome", type: "send_message", text: "Hi 👋 We would love to learn how we can help.", next_step_id: "name" },
      { id: "name", type: "ask_capture", text: "What is your name?", next_step_id: "need", capture: capture("name", "Name", "name") },
      { id: "need", type: "ask_capture", text: "What can we help you with?", next_step_id: "team", capture: capture("interest", "What they need", "text") },
      { id: "team", type: "human_handoff", reason: "New lead qualification" }
    ] } ) },
  { id: "customer_details", title: "Capture Customer Details", industries: [], description: "Collect contact details before your team continues the conversation.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "Thanks for getting in touch. We will collect a few details to help our team assist you.", next_step_id: "name" },
      { id: "name", type: "ask_capture", text: "What is your name?", next_step_id: "email", capture: capture("name", "Name", "name") },
      { id: "email", type: "ask_capture", text: "What is your email address?", next_step_id: "team", capture: capture("email", "Email", "email") },
      { id: "team", type: "human_handoff", reason: "Customer details captured" }
    ] } ) },
  { id: "vehicle_service", title: "Vehicle Service Enquiry", industries: ["automotive", "vehicle", "motor"], description: "Collect vehicle and service details, then route the customer to staff.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "Hi 👋 We would like to get a few details about your vehicle.", next_step_id: "vehicle" },
      { id: "vehicle", type: "ask_capture", text: "What vehicle do you have?", next_step_id: "service", capture: capture("vehicle", "Vehicle", "text") },
      { id: "service", type: "choose_option", text: "What do you need help with?", choices: [
        option("service", "Vehicle Service", "team"), option("repairs", "Repairs", "team"), option("diagnostics", "Diagnostics", "team")
      ] },
      { id: "team", type: "human_handoff", reason: "Vehicle service enquiry" }
    ] } ) },
  { id: "quote", title: "Request a Quote", industries: ["professional", "services", "automotive", "construction"], description: "Collect what the customer needs for a team member to prepare a quote.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "We can help with a quote. Please share a few details.", next_step_id: "request" },
      { id: "request", type: "ask_capture", text: "What would you like a quote for?", next_step_id: "budget", capture: capture("quote_request", "Quote requirement", "text") },
      { id: "budget", type: "ask_capture", text: "Do you have a budget in mind? You can reply with a number or say not sure.", next_step_id: "team", capture: capture("budget", "Budget", "text", false) },
      { id: "team", type: "human_handoff", reason: "Quote request" }
    ] } ) },
  { id: "admissions", title: "Admissions Enquiry", industries: ["education", "school", "college"], description: "Collect parent or student enquiry details for an admissions team.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "Welcome. We can help with your admissions enquiry.", next_step_id: "name" },
      { id: "name", type: "ask_capture", text: "What is your name?", next_step_id: "question", capture: capture("name", "Name", "name") },
      { id: "question", type: "ask_capture", text: "What would you like to know about admissions?", next_step_id: "team", capture: capture("admissions_question", "Admissions question", "text") },
      { id: "team", type: "human_handoff", reason: "Admissions enquiry" }
    ] } ) },
  { id: "appointment", title: "Appointment Enquiry", industries: ["beauty", "wellness", "health", "salon"], description: "Collect a preferred date and time. This does not confirm a booking.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "We can help with your appointment enquiry.", next_step_id: "date" },
      { id: "date", type: "ask_capture", text: "What date would you prefer? Please use YYYY-MM-DD.", next_step_id: "time", capture: capture("preferred_date", "Preferred date", "date") },
      { id: "time", type: "ask_capture", text: "What time would you prefer?", next_step_id: "team", capture: capture("preferred_time", "Preferred time", "text") },
      { id: "team", type: "human_handoff", reason: "Appointment enquiry" }
    ] } ) },
  { id: "support", title: "Support Triage", industries: ["education", "professional", "services"], description: "Understand the issue and direct the customer to the right team.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "We are here to help. Please tell us a little about your issue.", next_step_id: "issue" },
      { id: "issue", type: "ask_capture", text: "What do you need help with?", next_step_id: "team", capture: capture("support_issue", "Support issue", "text") },
      { id: "team", type: "human_handoff", reason: "Support request" }
    ] } ) },
  { id: "product_order", title: "Product / Order Enquiry", industries: ["food", "manufacturing", "retail", "shop"], description: "Collect product or order information for your team.", build: () => ({
    entry_step_key: "intro", steps: [
      { id: "intro", type: "send_message", text: "Thanks for your interest. We will collect a few details.", next_step_id: "product" },
      { id: "product", type: "ask_capture", text: "Which product or order do you need help with?", next_step_id: "team", capture: capture("product_or_order", "Product or order", "text") },
      { id: "team", type: "human_handoff", reason: "Product or order enquiry" }
    ] } ) }
]

function capture(key, label, type, required = true) {
  return { key, label, type, required, validation: type === "choice" ? { options: [] } : {}, failure_action: "handoff", max_attempts: 2 }
}
function option(id, label, next_step_id) { return { id, label, aliases: [], next_step_id, outcome: null } }
function blankFlow() {
  return { entry_step_key: "message_1", steps: [
    { id: "message_1", type: "send_message", text: "Hi 👋 How can we help today?", next_step_id: "finish_1" },
    { id: "finish_1", type: "end", text: "" }
  ] }
}
function clone(value) { return JSON.parse(JSON.stringify(value)) }
function flowStatus(status) { return String(status || "draft").replace("_", " ") }
function statusColor(status) { return status === "published" ? "badge-green" : status === "paused" ? "badge-red" : "badge-gold" }
function eventLabel(event) {
  return ({ started: "Started", step_advanced: "Step completed", validation_failed: "Answer couldn't be validated", completed: "Completed", handed_off: "Sent to team", cancelled: "Cancelled", abandoned: "Abandoned", failed: "Failed" })[event] || "Updated"
}
function stableKey(label, fallback) {
  const key = String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48)
  return key && /^[a-z]/.test(key) ? key : fallback
}
function nextId(type, steps) {
  let index = steps.length + 1
  let id = `${type}_${index}`
  while (steps.some(step => step.id === id)) id = `${type}_${++index}`
  return id
}
function readableType(type) {
  return ({ send_message: "Send a message", ask_capture: "Ask & capture", choose_option: "Give choices", content: "Share content", human_handoff: "Hand to team", end: "End flow" })[type] || type
}

export function ChatbotFlows({ customer, apiFetch }) {
  const [flows, setFlows] = useState([])
  const [setup, setSetup] = useState({ numbers: [], discovery: null })
  const [selectedNumberId, setSelectedNumberId] = useState("")
  const [activity, setActivity] = useState([])
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [mode, setMode] = useState("home")
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testInputs, setTestInputs] = useState([])
  const [testResult, setTestResult] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const canManage = ["owner", "admin"].includes(customer?.role)

  const recommended = useMemo(() => {
    const source = [customer?.industry, setup.discovery?.industry, ...(setup.discovery?.goals || [])].join(" ").toLowerCase()
    const matches = recipes.filter(recipe => recipe.industries.some(industry => source.includes(industry)))
    return (matches.length ? matches : recipes.slice(0, 3)).slice(0, 4)
  }, [customer?.industry, setup.discovery])

  const load = async () => {
    setLoading(true)
    try {
      const [flowResponse, setupResponse, activityResponse, contentResponse] = await Promise.all([
        apiFetch("/chatbot-flows"), apiFetch("/chatbot-flows/setup"), apiFetch("/chatbot-flows/activity"), apiFetch("/content")
      ])
      setFlows(await flowResponse.json())
      const setupData = await setupResponse.json()
      setSetup(setupData)
      setSelectedNumberId(current => (setupData.numbers || []).some(number => number.id === current) ? current : ((setupData.numbers || []).length === 1 ? setupData.numbers[0].id : ""))
      setActivity(await activityResponse.json())
      const items = await contentResponse.json()
      setContent((items.items || []).filter(item => ["TEXT", "LINK"].includes(item.content_type) && !item.archived_at))
      setError("")
    } catch (err) { setError(err.message || "Unable to load Chatbot Flows") }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [customer?.id])

  const openFlow = async (flow) => {
    try {
      const response = await apiFetch(`/chatbot-flows/${flow.id}`)
      const detail = await response.json()
      setSelected(detail); setDraft(clone(detail.draft_definition)); setDraftDirty(false); setMode("builder"); setTestResult(null)
    } catch (err) { setError(err.message || "Unable to open this flow") }
  }

  const createFlow = async (recipe) => {
    if (!canManage) return
    const numberId = selectedNumberId || (setup.numbers?.length === 1 ? setup.numbers[0].id : "")
    if (!numberId) { setError(setup.numbers?.length ? "Choose the WhatsApp number this flow will use." : "Connect a WhatsApp number before creating a Chatbot Flow."); return }
    setSaving(true)
    setError("")
    try {
      // Library selections send only their stable selector. The backend owns
      // the recipe definition and creates the workspace-scoped draft.
      const path = recipe ? "/chatbot-flows/from-library" : "/chatbot-flows"
      const body = recipe
        ? { template_id: recipe.id, whatsapp_number_id: numberId }
        : { name: "Untitled flow", whatsapp_number_id: numberId, draft_definition: blankFlow() }
      const response = await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const created = await response.json()
      // Open the returned, server-created draft directly. A second request
      // must not strand the owner in the preview after a successful create.
      setFlows(current => [created, ...current.filter(flow => flow.id !== created.id)])
      setSelected(created); setDraft(clone(created.draft_definition)); setDraftDirty(false)
      setMode("builder"); setTestResult(null); setReviewOpen(false)
    } catch (err) { setError(err.message || "Unable to create this flow") }
    finally { setSaving(false) }
  }
  const useTemplate = async (templateId) => {
    const recipe = recipes.find(item => item.id === templateId)
    if (!recipe) { setError("That Chatbot Flow template is not available."); return }
    await createFlow(recipe)
  }

  const changeDraft = (next) => { setDraft(next); setDraftDirty(true) }
  const updateStep = (index, patch) => changeDraft({ ...draft, steps: draft.steps.map((step, position) => position === index ? { ...step, ...patch } : step) })
  const addStep = (type) => {
    const id = nextId(type, draft.steps)
    const base = type === "send_message" ? { id, type, text: "", next_step_id: "" }
      : type === "ask_capture" ? { id, type, text: "", next_step_id: "", capture: capture("answer", "Answer", "text") }
      : type === "choose_option" ? { id, type, text: "", choices: [option("option_1", "First option", ""), option("option_2", "Second option", "")] }
      : type === "content" ? { id, type, content_library_item_id: "", next_step_id: "" }
      : type === "human_handoff" ? { id, type, reason: "Requested by chatbot flow" }
      : { id, type: "end", text: "" }
    const steps = [...draft.steps, base]
    if (draft.steps.length) {
      const previous = steps[steps.length - 2]
      if (["send_message", "ask_capture", "content"].includes(previous.type) && !previous.next_step_id) previous.next_step_id = id
    }
    changeDraft({ ...draft, steps })
  }
  const moveStep = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= draft.steps.length) return
    const steps = clone(draft.steps); [steps[index], steps[target]] = [steps[target], steps[index]]
    changeDraft({ ...draft, steps })
  }
  const removeStep = (index) => {
    if (draft.steps.length <= 1) return
    const removed = draft.steps[index]
    const steps = draft.steps.filter((_, position) => position !== index)
    for (const step of steps) {
      if (step.next_step_id === removed.id) step.next_step_id = steps[Math.min(index, steps.length - 1)]?.id || ""
      if (step.type === "choose_option") step.choices = step.choices.map(choice => choice.next_step_id === removed.id ? { ...choice, next_step_id: "", outcome: "end" } : choice)
    }
    changeDraft({ ...draft, entry_step_key: draft.entry_step_key === removed.id ? steps[0].id : draft.entry_step_key, steps })
  }
  const saveDraft = async () => {
    setSaving(true)
    try {
      const response = await apiFetch(`/chatbot-flows/${selected.id}/draft`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: selected.name, draft_definition: draft }) })
      const updated = await response.json()
      setSelected({ ...selected, ...updated }); setDraft(clone(updated.draft_definition)); setDraftDirty(false); setError("")
      await load()
      return updated
    } catch (err) { setError(err.message || "Unable to save this draft"); return null }
    finally { setSaving(false) }
  }
  const runTest = async () => {
    if (draftDirty && !(await saveDraft())) return
    setSaving(true)
    try {
      const response = await apiFetch(`/chatbot-flows/${selected.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs: testInputs }) })
      setTestResult((await response.json()).simulation); setError("")
    } catch (err) { setError(err.message || "Unable to test this flow") }
    finally { setSaving(false) }
  }
  const publish = async () => {
    if (draftDirty && !(await saveDraft())) return
    setSaving(true)
    try {
      const response = await apiFetch(`/chatbot-flows/${selected.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" } })
      const result = await response.json()
      setSelected({ ...selected, ...result.flow }); setReviewOpen(false); setError(""); await load()
    } catch (err) { setError(err.message || "Unable to publish this flow") }
    finally { setSaving(false) }
  }
  const lifecycle = async (action) => {
    try {
      const response = await apiFetch(`/chatbot-flows/${selected.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" } })
      const updated = await response.json(); setSelected({ ...selected, ...updated }); await load()
    } catch (err) { setError(err.message || "Unable to update this flow") }
  }

  if (loading) return <div className="pad" style={{ padding: 32 }}><div className="spin" /></div>
  if (mode === "builder" && selected && draft) return <FlowBuilder {...{ selected, draft, setSelected, updateStep, addStep, moveStep, removeStep, changeDraft, saveDraft, draftDirty, saving, runTest, testResult, setTestInputs, testInputs, publish, reviewOpen, setReviewOpen, lifecycle, content, canManage, useTemplate, error, setup, selectedNumberId, setSelectedNumberId, onBack: () => { setMode("home"); setSelected(null); setDraft(null); setTestResult(null); load() } }} />

  return <div className="pad" style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 26 }}>
      <div><div className="mono" style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Chatbot Flows</div><h1 className="editorial" style={{ fontSize: 42, color: "var(--cream)", fontWeight: 500 }}>Guide every conversation</h1><p style={{ color: "var(--mist)", marginTop: 8, maxWidth: 640, fontSize: 14 }}>Build guided WhatsApp conversations that ask questions, collect information and route customers to the right next step.</p></div>
      {canManage && <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>{setup.numbers?.length > 1 && <label className="label" style={{ margin: 0, minWidth: 230 }}>WhatsApp number<select className="input" value={selectedNumberId} onChange={event => setSelectedNumberId(event.target.value)}><option value="">Choose a connected WhatsApp number</option>{setup.numbers.map(number => <option key={number.id} value={number.id}>{number.display_name || number.phone_number || "Connected WhatsApp number"}</option>)}</select></label>}<button className="btn btn-gold" onClick={() => createFlow(null)}>+ Create flow</button></div>}
    </div>
    {error && <div role="alert" style={{ border: "1px solid rgba(239,68,68,.35)", color: "var(--error-text)", padding: 12, marginBottom: 16, fontSize: 13 }}>{error}</div>}
    {!canManage && <div className="card" style={{ padding: 14, color: "var(--cream2)", fontSize: 13, marginBottom: 18 }}>You can view flows and activity. An owner or admin can create and publish changes.</div>}
    <Section title="Recommended Flows" subtitle="Suggestions based on your business workspace.">
      <div className="flow-grid">{recommended.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} canManage={canManage} onPreview={() => { setSelected({ name: recipe.title, draft_definition: recipe.build(), lifecycle_status: "template", library_template_id: recipe.id }); setDraft(recipe.build()); setMode("builder") }} onUse={() => createFlow(recipe)} />)}</div>
    </Section>
    <Section title="Flow Library" subtitle="Ready-made conversation starters.">
      <div className="flow-grid">{recipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} canManage={canManage} onPreview={() => { setSelected({ name: recipe.title, draft_definition: recipe.build(), lifecycle_status: "template", library_template_id: recipe.id }); setDraft(recipe.build()); setMode("builder") }} onUse={() => createFlow(recipe)} />)}</div>
    </Section>
    <Section title="Your Flows" subtitle="Drafts do not run. Published flows are used only for new customer sessions.">
      {!flows.length ? <div className="card"><FlowEmpty msg="No Chatbot Flows yet" /></div> : <div className="card">{flows.map(flow => <div key={flow.id} style={{ padding: "16px 18px", borderBottom: "1px solid var(--wire)", display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}><div><div style={{ color: "var(--cream)", fontWeight: 600 }}>{flow.name}</div><div style={{ color: "var(--mist)", fontSize: 12, marginTop: 4 }}>Updated {new Date(flow.updated_at || flow.created_at).toLocaleDateString()}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={"badge " + statusColor(flow.lifecycle_status)}>{flowStatus(flow.lifecycle_status)}</span><button className="btn btn-wire" onClick={() => openFlow(flow)}>View {canManage ? "/ Edit" : ""}</button></div></div>)}</div>}
    </Section>
    <Section title="Flow Activity" subtitle="Recent operational events. Customer message content is never shown here.">
      {!activity.length ? <div className="card"><FlowEmpty msg="No flow activity yet" /></div> : <div className="card">{activity.slice(0, 20).map(item => <div key={item.id} style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", gap: 14, borderBottom: "1px solid var(--wire)", fontSize: 13 }}><span style={{ color: "var(--cream2)" }}>{eventLabel(item.event_type)}</span><span className="mono" style={{ color: "var(--mist)", fontSize: 10 }}>{new Date(item.created_at).toLocaleString()}</span></div>)}</div>}
    </Section>
  </div>
}

function FlowEmpty({ msg }) { return <div style={{ padding: "38px 20px", textAlign: "center" }}><span className="mono" style={{ color: "var(--mist)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{msg}</span></div> }
function Section({ title, subtitle, children }) { return <section style={{ marginTop: 32 }}><div style={{ marginBottom: 13 }}><h2 className="editorial" style={{ color: "var(--cream)", fontSize: 28, fontWeight: 500 }}>{title}</h2>{subtitle && <p style={{ color: "var(--mist)", fontSize: 13, marginTop: 4 }}>{subtitle}</p>}</div>{children}</section> }
function RecipeCard({ recipe, canManage, onPreview, onUse }) { return <div className="card" style={{ padding: 18, minHeight: 175, display: "flex", flexDirection: "column", alignItems: "flex-start" }}><span className="badge badge-gold">Ready-made</span><h3 style={{ color: "var(--cream)", marginTop: 14, fontSize: 16 }}>{recipe.title}</h3><p style={{ color: "var(--mist)", fontSize: 13, lineHeight: 1.5, marginTop: 8, flex: 1 }}>{recipe.description}</p><div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="btn btn-wire" onClick={onPreview}>Preview</button>{canManage && <button className="btn btn-gold" onClick={onUse}>Use template</button>}</div></div> }

function FlowBuilder(props) {
  const { selected, draft, setSelected, updateStep, addStep, moveStep, removeStep, changeDraft, saveDraft, draftDirty, saving, runTest, testResult, setTestInputs, testInputs, publish, reviewOpen, setReviewOpen, lifecycle, content, canManage, useTemplate, error, setup, selectedNumberId, setSelectedNumberId, onBack } = props
  const steps = draft.steps || []
  const isTemplate = !selected.id
  const stepOptions = (current) => steps.filter(step => step.id !== current).map(step => ({ value: step.id, label: readableType(step.type) + " · Step " + (steps.indexOf(step) + 1) }))
  const updateChoice = (stepIndex, choiceIndex, patch) => {
    const step = steps[stepIndex]; updateStep(stepIndex, { choices: step.choices.map((choice, index) => index === choiceIndex ? { ...choice, ...patch } : choice) })
  }
  const canEdit = canManage && !isTemplate
  return <div className="pad" style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}><button className="btn btn-wire" onClick={onBack}>← Back to flows</button><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{isTemplate && canManage && <button className="btn btn-gold" disabled={saving} onClick={() => useTemplate(selected.library_template_id)}>{saving ? "Creating…" : "Use template"}</button>}{canEdit && <><button className="btn btn-wire" disabled={saving} onClick={saveDraft}>{saving ? "Saving…" : draftDirty ? "Save draft" : "Saved"}</button><button className="btn btn-wire" disabled={saving} onClick={runTest}>Test flow</button><button className="btn btn-gold" disabled={saving} onClick={() => setReviewOpen(true)}>Review & publish</button></>}</div></div>
    {error && <div role="alert" style={{ border: "1px solid rgba(239,68,68,.35)", color: "var(--error-text)", padding: 12, marginBottom: 16, fontSize: 13 }}>{error}</div>}
    {isTemplate && canManage && setup.numbers?.length > 1 && <label className="label" style={{ marginBottom: 16 }}>WhatsApp number for this flow<select className="input" value={selectedNumberId} onChange={event => setSelectedNumberId(event.target.value)}><option value="">Choose a connected WhatsApp number</option>{setup.numbers.map(number => <option key={number.id} value={number.id}>{number.display_name || number.phone_number || "Connected WhatsApp number"}</option>)}</select></label>}
    <div className="card" style={{ padding: 20, marginBottom: 16 }}><span className={"badge " + statusColor(selected.lifecycle_status)}>{isTemplate ? "Template preview" : flowStatus(selected.lifecycle_status)}</span><input aria-label="Flow name" className="input" disabled={!canEdit} value={selected.name || ""} onChange={event => { setSelected({ ...selected, name: event.target.value }); changeDraft(draft) }} style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, border: "none", padding: "12px 0 2px", background: "transparent" }} /><p style={{ color: "var(--mist)", fontSize: 13 }}>Message → Question → Choice → Next step → Hand to team or finish.</p></div>
    {isTemplate && <div className="card" style={{ padding: 16, color: "var(--cream2)", marginBottom: 16 }}>This is an approximate conversation preview. Use this template to create a private draft for your workspace. It will not publish or send anything automatically.</div>}
    {steps.map((step, index) => <div key={step.id} style={{ marginBottom: 12 }}><StepCard {...{ step, index, steps, updateStep, moveStep, removeStep, addStep, canEdit, content, stepOptions, updateChoice }} /></div>)}
    {canEdit && <AddStep onAdd={addStep} />}
    {canEdit && <TestPanel {...{ testInputs, setTestInputs, runTest, testResult, saving }} />}
    {reviewOpen && <ReviewModal draft={draft} selected={selected} close={() => setReviewOpen(false)} publish={publish} saving={saving} />}
    {!isTemplate && canManage && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>{selected.lifecycle_status === "published" && <button className="btn btn-wire" onClick={() => lifecycle("pause")}>Pause new starts</button>}{selected.lifecycle_status === "paused" && <button className="btn btn-gold" onClick={() => lifecycle("resume")}>Resume</button>}{selected.lifecycle_status !== "archived" && <button className="btn btn-danger" onClick={() => lifecycle("archive")}>Archive</button>}</div>}
  </div>
}

function StepCard({ step, index, steps, updateStep, moveStep, removeStep, canEdit, content, stepOptions, updateChoice }) {
  const set = patch => updateStep(index, patch)
  const choices = step.choices || []
  return <div className="card" style={{ padding: 18, borderLeft: "2px solid var(--gold)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="badge badge-gold">Step {index + 1}</span><strong style={{ color: "var(--cream)", fontSize: 14 }}>{readableType(step.type)}</strong></div>{canEdit && <div style={{ display: "flex", gap: 6 }}><button className="btn btn-wire" onClick={() => moveStep(index, -1)} disabled={index === 0}>↑</button><button className="btn btn-wire" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>↓</button><button className="btn btn-danger" onClick={() => removeStep(index)}>Remove</button></div>}</div>
    {step.type === "send_message" && <><label className="label" style={{ marginTop: 16 }}>Message</label><textarea className="textarea" disabled={!canEdit} value={step.text || ""} onChange={event => set({ text: event.target.value })} placeholder="Write the message customers will receive."/><NextSelect disabled={!canEdit} value={step.next_step_id} options={stepOptions(step.id)} onChange={value => set({ next_step_id: value })}/></>}
    {step.type === "ask_capture" && <><label className="label" style={{ marginTop: 16 }}>Question</label><textarea className="textarea" disabled={!canEdit} value={step.text || ""} onChange={event => set({ text: event.target.value })} placeholder="Ask a question."/><div className="field-grid" style={{ marginTop: 12 }}><Field label="Save answer as"><input className="input" disabled={!canEdit} value={step.capture?.label || ""} onChange={event => set({ capture: { ...step.capture, label: event.target.value, key: stableKey(event.target.value, "answer") } })}/></Field><Field label="Answer type"><select className="input" disabled={!canEdit} value={step.capture?.type || "text"} onChange={event => set({ capture: { ...step.capture, type: event.target.value, validation: event.target.value === "choice" ? { options: step.capture?.validation?.options || [] } : {} } })}>{fieldTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field></div><label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--cream2)", fontSize: 13, marginTop: 12 }}><input type="checkbox" disabled={!canEdit} checked={step.capture?.required !== false} onChange={event => set({ capture: { ...step.capture, required: event.target.checked } })}/> Required answer</label>{step.capture?.type === "choice" && <ChoiceCaptureOptions capture={step.capture} canEdit={canEdit} set={capture => set({ capture })}/>}<Field label="If two answers cannot be validated"><select className="input" disabled={!canEdit} value={step.capture?.failure_action || "handoff"} onChange={event => set({ capture: { ...step.capture, failure_action: event.target.value } })}><option value="handoff">Send to my team</option><option value="end">End the flow</option></select></Field><NextSelect disabled={!canEdit} value={step.next_step_id} options={stepOptions(step.id)} onChange={value => set({ next_step_id: value })}/></>}
    {step.type === "choose_option" && <><label className="label" style={{ marginTop: 16 }}>Question</label><textarea className="textarea" disabled={!canEdit} value={step.text || ""} onChange={event => set({ text: event.target.value })} placeholder="What do you need help with?"/><div style={{ marginTop: 12 }}>{choices.map((choice, choiceIndex) => <div key={choice.id || choiceIndex} style={{ borderTop: "1px solid var(--wire)", paddingTop: 10, marginTop: 10 }}><div className="field-grid"><Field label={(choiceIndex + 1) + ". Choice"}><input className="input" disabled={!canEdit} value={choice.label || ""} onChange={event => updateChoice(index, choiceIndex, { label: event.target.value })}/></Field><Field label="Then"><select className="input" disabled={!canEdit} value={choice.outcome || choice.next_step_id || ""} onChange={event => { const value = event.target.value; updateChoice(index, choiceIndex, value === "human_handoff" || value === "end" ? { outcome: value, next_step_id: null } : { outcome: null, next_step_id: value }) }}><option value="">Choose next action</option>{stepOptions(step.id).map(item => <option key={item.value} value={item.value}>Continue to {item.label}</option>)}<option value="human_handoff">Send to team</option><option value="end">Finish flow</option></select></Field></div>{canEdit && <button className="btn btn-wire" style={{ marginTop: 8 }} onClick={() => set({ choices: choices.filter((_, position) => position !== choiceIndex) })} disabled={choices.length <= 2}>Remove choice</button>}</div>)}</div>{canEdit && <button className="btn btn-wire" style={{ marginTop: 12 }} onClick={() => set({ choices: [...choices, option("option_" + (choices.length + 1), "New option", "")] })}>+ Add choice</button>}</>}
    {step.type === "content" && <><Field label="Content Library item"><select className="input" disabled={!canEdit} value={step.content_library_item_id || ""} onChange={event => set({ content_library_item_id: event.target.value })}><option value="">Choose Text or Link content</option>{content.map(item => <option key={item.id} value={item.id}>{item.name} · {item.content_type === "TEXT" ? "Text" : "Link"}</option>)}</select></Field><p style={{ color: "var(--mist)", fontSize: 12 }}>Content remains in your Content Library and is checked again when the flow runs.</p><NextSelect disabled={!canEdit} value={step.next_step_id} options={stepOptions(step.id)} onChange={value => set({ next_step_id: value })}/></>}
    {step.type === "human_handoff" && <><p style={{ color: "var(--cream2)", fontSize: 13, lineHeight: 1.5, marginTop: 14 }}>Pause automation and move this conversation to your Team Inbox for a person to continue.</p><Field label="Team context"><input className="input" disabled={!canEdit} value={step.reason || ""} onChange={event => set({ reason: event.target.value })}/></Field></>}
    {step.type === "end" && <><p style={{ color: "var(--cream2)", fontSize: 13, marginTop: 14 }}>This completes the flow. The next customer message follows your normal automation rules.</p><Field label="Optional final message"><textarea className="textarea" disabled={!canEdit} value={step.text || ""} onChange={event => set({ text: event.target.value })} placeholder="Thanks — we have received your details."/></Field></>}
  </div>
}
function Field({ label, children }) { return <label className="label" style={{ marginTop: 12 }}>{label}{children}</label> }
function NextSelect({ value, options, onChange, disabled }) { return <Field label="Next step"><select className="input" disabled={disabled} value={value || ""} onChange={event => onChange(event.target.value)}><option value="">Choose next step</option>{options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field> }
function ChoiceCaptureOptions({ capture, set, canEdit }) { const options = capture.validation?.options || []; return <div style={{ marginTop: 12 }}><label className="label">Allowed answers</label>{options.map((item, index) => <input key={index} className="input" disabled={!canEdit} style={{ marginBottom: 7 }} value={item.label || ""} onChange={event => { const next = options.map((option, position) => position === index ? { ...option, label: event.target.value } : option); set({ ...capture, validation: { options: next } }) }}/>) }{canEdit && <button className="btn btn-wire" onClick={() => set({ ...capture, validation: { options: [...options, { label: "New option", value: "new_option", aliases: [] }] } })}>+ Add answer</button>}</div> }
function AddStep({ onAdd }) { return <div className="card" style={{ padding: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><span className="mono" style={{ color: "var(--mist)", fontSize: 10, letterSpacing: 1 }}>ADD STEP</span>{[["send_message","Message"],["ask_capture","Question"],["choose_option","Choice"],["content","Content"],["human_handoff","Hand to team"],["end","Finish"]].map(([type,label]) => <button key={type} className="btn btn-wire" onClick={() => onAdd(type)}>+ {label}</button>)}</div> }
function TestPanel({ testInputs, setTestInputs, runTest, testResult, saving }) { return <section className="card" style={{ padding: 18, marginTop: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ color: "var(--cream)", fontSize: 16 }}>Test Flow</h3><p style={{ color: "var(--mist)", fontSize: 12, marginTop: 4 }}>Simulation only. No WhatsApp message, customer session, contact or conversation is created.</p></div><button className="btn btn-gold" disabled={saving} onClick={runTest}>{saving ? "Testing…" : "Run test"}</button></div><textarea className="textarea" style={{ marginTop: 14 }} value={testInputs.join("\n")} onChange={event => setTestInputs(event.target.value.split("\n"))} placeholder={"Enter one customer reply per line.\nFord Ranger\n1"} />{testResult && <div style={{ marginTop: 14, borderTop: "1px solid var(--wire)", paddingTop: 14 }}><div className="mono" style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: 1 }}>SIMULATED CONVERSATION</div>{(testResult.transcript || testResult.output.map(text => ({ speaker: "zedping", text }))).map((message, index) => <div key={index} style={{ marginTop: 9, color: "var(--cream2)", fontSize: 13, whiteSpace: "pre-wrap" }}><b style={{ color: message.speaker === "you" ? "var(--cream)" : "var(--gold2)" }}>{message.speaker === "you" ? "You" : "ZedPing"}</b> · {message.text}</div>)}<div style={{ color: "var(--mist)", fontSize: 12, marginTop: 10 }}>Result: {testResult.waiting_for_input ? "Waiting for customer reply" : testResult.terminal === "human_handoff" ? "Would be sent to team" : testResult.terminal === "end" ? "Would complete" : testResult.terminal || "Waiting for customer reply"}</div></div>}</section> }
function ReviewModal({ draft, selected, close, publish, saving }) { return <div className="modal-bg" role="dialog" aria-modal="true"><div className="modal" style={{ maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}><div className="mono" style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: 2 }}>REVIEW FLOW</div><h2 className="editorial" style={{ color: "var(--cream)", fontSize: 34, marginTop: 8 }}>{selected.name}</h2><p style={{ color: "var(--mist)", fontSize: 13, marginTop: 8 }}>Publishing makes this version available to new customer sessions. Existing sessions are never changed.</p><div style={{ marginTop: 18 }}>{draft.steps.map((step, index) => <div key={step.id} style={{ borderLeft: "1px solid var(--gold)", padding: "0 0 14px 14px", color: "var(--cream2)", fontSize: 13 }}><b style={{ color: "var(--cream)" }}>{index + 1}. {readableType(step.type)}</b><div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{step.type === "choose_option" ? `${step.text}\n${(step.choices || []).map((choice, optionIndex) => `${optionIndex + 1}. ${choice.label}`).join("\n")}` : step.type === "ask_capture" ? `${step.text}\nSaves: ${step.capture?.label || "Answer"}` : step.type === "content" ? "Shares selected Content Library item" : step.type === "human_handoff" ? "Moves conversation to Team Inbox" : step.text || "Completes the flow"}</div></div>)}</div><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12 }}><button className="btn btn-wire" onClick={close}>Back to customize</button><button className="btn btn-gold" disabled={saving} onClick={publish}>{saving ? "Publishing…" : "Publish flow"}</button></div></div></div> }
