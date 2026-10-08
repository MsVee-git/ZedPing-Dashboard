export function automationDraft(item = {}) {
  return {
    phrases: (item.trigger_config?.phrases || (item.trigger_value ? [item.trigger_value] : [])).join('\n'),
    kind: item.action_config?.kind === 'human_handoff' ? 'human_handoff' : item.chatbot_flow_id ? 'start_chatbot_flow' : item.action_config?.kind || (item.content_library_item_id ? 'content_library' : 'send_text'),
    response: item.message_template || '', contentId: item.content_library_item_id || '',
    flowId: item.chatbot_flow_id || '', priority: item.priority ?? 100,
  };
}
export function exactPhrases(value) {
  return [...new Set(String(value || '').split('\n').map(x => x.trim().toUpperCase()).filter(Boolean))];
}
export function customAutomationPayload(draft) {
  const phrases = exactPhrases(draft.phrases);
  if (!phrases.length || phrases.length > 10 || phrases.some(x => x.length > 160)) throw new Error('Enter 1–10 exact phrases, each up to 160 characters.');
  if (!['send_text', 'content_library', 'start_chatbot_flow', 'human_handoff'].includes(draft.kind)) throw new Error('Choose an action.');
  const priority = Number(draft.priority);
  if (String(draft.priority).trim() === '' || !Number.isInteger(priority) || priority < 0 || priority > 100000) throw new Error('Priority must be a whole number between 0 and 100000.');
  const response = String(draft.response || '').trim();
  if (draft.kind === 'send_text' && (!response || response.length > 4096)) throw new Error('Write a response of up to 4096 characters.');
  if (draft.kind === 'content_library' && !draft.contentId) throw new Error('Choose active Text or Link content.');
  if (draft.kind === 'start_chatbot_flow' && !draft.flowId) throw new Error('Choose an active published chatbot flow.');
  return { automation_type: 'custom', trigger_type: 'keyword', trigger_value: phrases[0],
    trigger_config: { phrases }, condition_config: {}, action_config: { kind: draft.kind },
    message_template: draft.kind === 'send_text' ? response : '',
    content_library_item_id: draft.kind === 'content_library' ? draft.contentId : null,
    chatbot_flow_id: draft.kind === 'start_chatbot_flow' ? draft.flowId : null, priority };
}
export function phraseConflicts(payload, rules, excludeId) {
  return rules.filter(rule => rule.id !== excludeId && rule.is_active && !rule.archived_at)
    .filter(rule => (rule.trigger_config?.phrases || [rule.trigger_value]).some(phrase => payload.trigger_config.phrases.includes(String(phrase || '').trim().toUpperCase())));
}
export function previewCustomAutomation(payload, message) {
  return payload.trigger_config.phrases.includes(String(message || '').trim().toUpperCase());
}
