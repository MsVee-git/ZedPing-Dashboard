import { useEffect, useRef, useState } from 'react';
import { automationDraft, customAutomationPayload, phraseConflicts, previewCustomAutomation } from './lib/customAutomation';

type Props = { item?: any; rules: any[]; content: any[]; flows: any[]; resourcesLoading?: boolean; resourcesError?: string; canManage: boolean; request: (path: string, init?: RequestInit) => Promise<Response>; onSaved: () => void; onClose: () => void };

export function CustomAutomationBuilder({ item, rules, content, flows, resourcesLoading, resourcesError, canManage, request, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState(() => automationDraft(item));
  const [review, setReview] = useState<any>(null);
  const [sample, setSample] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!canManage) return;
    const previous = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const fields = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || []).filter(x => !x.closest('fieldset:disabled'));
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [canManage]);
  if (!canManage) return null;
  const change = (key: string, value: any) => { setDraft(current => ({ ...current, [key]: value })); setReview(null); setResult(''); setError(''); };
  const conflicts = review ? phraseConflicts(review, rules, item?.id) : [];
  const actionLabels = { send_text: 'Send a message', content_library: 'Use Content Library', start_chatbot_flow: 'Start a chatbot flow', human_handoff: 'Hand off to the team' };
  const contentOptions = content.filter(x => !x.archived_at && ['TEXT', 'LINK'].includes(x.content_type));
  const flowOptions = flows.filter(x => !x.archived_at && x.lifecycle_status === 'published' && x.is_active);
  const validate = () => {
    const payload = customAutomationPayload(draft);
    if (payload.content_library_item_id && !contentOptions.some(x => x.id === payload.content_library_item_id)) throw new Error('The selected content is no longer available.');
    if (payload.chatbot_flow_id && !flowOptions.some(x => x.id === payload.chatbot_flow_id)) throw new Error('The selected flow is no longer active and published.');
    return payload;
  };
  const test = () => {
    try { const payload = validate(); setReview(payload); setError(''); setResult(previewCustomAutomation(payload, sample) ? 'Phrase matches. The selected action would run when this rule is eligible.' : 'Phrase does not match. This rule would not run.'); }
    catch (failure) { setError(failure.message); setResult(''); }
  };
  const save = async () => {
    if (savingRef.current) return;
    try {
      const payload = validate();
      if (!review || JSON.stringify(review) !== JSON.stringify(payload)) throw new Error('Review your automation before saving.');
      if (phraseConflicts(payload, rules, item?.id).length) throw new Error('An active rule already uses one of these phrases. Edit that rule or choose another phrase.');
      savingRef.current = true; setSaving(true); setError('');
      const response = await request('/automations' + (item ? '/' + item.id : ''), { method: item ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Unable to save automation.'); }
      onSaved();
    } catch (failure) { setError(failure.message || 'Unable to save automation.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Custom automation builder"><div ref={dialogRef} className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
    <h2>{item ? 'Edit custom automation' : 'Create automation'}</h2>
    <p>Create a rule for incoming customer messages across this workspace. Exact phrases ignore capitalization and surrounding spaces.</p>
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
      <label className="label" htmlFor="custom-phrases">When a customer says</label>
      <textarea id="custom-phrases" className="textarea" value={draft.phrases} onChange={e => change('phrases', e.target.value)} placeholder={'PRICE\nHOW MUCH'} />
      <p>Enter one exact phrase per line, up to 10.</p>
      <label className="label" htmlFor="custom-action">Then</label>
      <select id="custom-action" className="input" value={draft.kind} onChange={e => change('kind', e.target.value)}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {draft.kind === 'send_text' && <><label className="label" htmlFor="custom-response">Message to send</label><textarea id="custom-response" className="textarea" maxLength={4096} value={draft.response} onChange={e => change('response', e.target.value)} /></>}
      {draft.kind === 'content_library' && <><label className="label" htmlFor="custom-content">Content</label><select id="custom-content" className="input" disabled={resourcesLoading || !!resourcesError} value={draft.contentId} onChange={e => change('contentId', e.target.value)}><option value="">Choose Text or Link content</option>{contentOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {draft.kind === 'start_chatbot_flow' && <><label className="label" htmlFor="custom-flow">Published flow</label><select id="custom-flow" className="input" disabled={resourcesLoading || !!resourcesError} value={draft.flowId} onChange={e => change('flowId', e.target.value)}><option value="">Choose an active published flow</option>{flowOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {draft.kind === 'human_handoff' && <p>This moves the conversation to Team Inbox and pauses automation for human assistance.</p>}
      {resourcesError && ['content_library', 'start_chatbot_flow'].includes(draft.kind) && <p role="alert">Unable to load content or flows. Close and reopen the builder to retry.</p>}
      <label className="label" htmlFor="custom-priority">Priority</label><input id="custom-priority" className="input" type="number" min={0} max={100000} step={1} value={draft.priority} onChange={e => change('priority', e.target.value)} />
      <p>Lower numbers run first. Conversations already handled by a team member, AI agent or active flow follow their existing routing.</p>
      <label className="label" htmlFor="custom-sample">Test a customer message</label><input id="custom-sample" className="input" value={sample} onChange={e => { setSample(e.target.value); setResult(''); }} />
      <button type="button" className="btn btn-wire" onClick={test} disabled={!sample.trim()}>Test phrase</button>
      <p>This preview does not send messages or start a conversation.</p>{result && <p role="status">{result}</p>}
      <button type="button" className="btn btn-wire" onClick={() => { try { setReview(validate()); setError(''); } catch (failure) { setError(failure.message); } }}>Review automation</button>
      {review && <section aria-label="Automation review"><h3>Review</h3><p>When: {review.trigger_config.phrases.join(', ')}</p><p>Action: {actionLabels[review.action_config.kind]}</p>{review.message_template && <p style={{ whiteSpace: 'pre-wrap' }}>{review.message_template}</p>}{review.content_library_item_id && <p>Content: {contentOptions.find(x => x.id === review.content_library_item_id)?.name}</p>}{review.chatbot_flow_id && <p>Flow: {flowOptions.find(x => x.id === review.chatbot_flow_id)?.name}</p>}<p>{item ? 'Saving preserves the rule’s active or paused state.' : 'Saving activates this rule immediately.'}</p>{conflicts.length > 0 && <p role="alert">An active rule already uses one of these phrases. Choose another phrase or edit that rule.</p>}</section>}
    </fieldset>
    {error && <p role="alert" style={{ color: 'var(--error-text)' }}>{error}</p>}
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}><button className="btn btn-wire" disabled={saving} onClick={onClose}>Cancel</button><button className="btn btn-gold" disabled={saving || !review || conflicts.length > 0} onClick={save}>{saving ? 'Saving…' : item ? 'Save changes' : 'Save and activate'}</button></div>
  </div></div>;
}
