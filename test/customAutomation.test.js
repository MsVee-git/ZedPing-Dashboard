import test from 'node:test';
import assert from 'node:assert/strict';
import { automationDraft, customAutomationPayload, phraseConflicts, previewCustomAutomation } from '../src/lib/customAutomation.js';
const draft = (overrides = {}) => ({ phrases: 'price\n PRICE \nHOW MUCH', kind: 'send_text', response: 'Our team can help.', priority: 100, ...overrides });
test('custom rules create supported payloads without invented library provenance', () => {
  const payload = customAutomationPayload(draft());
  assert.deepEqual(payload.trigger_config.phrases, ['PRICE','HOW MUCH']);
  assert.equal(payload.automation_type, 'custom');
  assert.equal('library_template_id' in payload, false);
  assert.equal(payload.chatbot_flow_id, null);
});
test('each action removes stale fields from previously chosen actions', () => {
  for (const kind of ['content_library','start_chatbot_flow','human_handoff']) {
    const payload = customAutomationPayload(draft({ kind, contentId:'content',flowId:'flow' }));
    assert.equal(payload.message_template,'');
    assert.equal(payload.content_library_item_id,kind==='content_library'?'content':null);
    assert.equal(payload.chatbot_flow_id,kind==='start_chatbot_flow'?'flow':null);
  }
});
test('validation refuses empty, oversized and invalid rules before any request', () => {
  for(const overrides of [{phrases:''},{phrases:Array.from({length:11},(_,i)=>'p'+i).join('\n')},{phrases:'x'.repeat(161)},{response:''},{priority:''},{priority:-1},{priority:1.5},{kind:'schedule'},{kind:'content_library'},{kind:'start_chatbot_flow'}]) assert.throws(()=>customAutomationPayload(draft(overrides)));
});
test('phrase preview follows runtime exact matching including case and whitespace', () => {
  const payload=customAutomationPayload(draft());
  assert.equal(previewCustomAutomation(payload,' price '),true);
  assert.equal(previewCustomAutomation(payload,'What is the price?'),false);
});
test('conflicts include active library and legacy rules but exclude self, paused and archived', () => {
  const payload=customAutomationPayload(draft());
  const rules=[{id:'self',is_active:true,trigger_value:'price'},{id:'legacy',is_active:true,trigger_value:'PRICE'},{id:'library',is_active:true,trigger_config:{phrases:['how much']}},{id:'paused',is_active:false,trigger_value:'price'},{id:'archived',is_active:true,archived_at:'today',trigger_value:'price'}];
  assert.deepEqual(phraseConflicts(payload,rules,'self').map(x=>x.id),['legacy','library']);
});
test('editing an existing rule restores its actual action and priority',()=>{
  assert.deepEqual(automationDraft({trigger_config:{phrases:['MENU']},action_config:{kind:'content_library'},content_library_item_id:'c',priority:20}),{phrases:'MENU',kind:'content_library',response:'',contentId:'c',flowId:'',priority:20});
});
