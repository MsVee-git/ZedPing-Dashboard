import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/ZoeAI.tsx', import.meta.url), 'utf8');
test('follow-ups need no per-agent toggle or template selection in the draft editor', () => {
  assert.match(source, /In Live mode, AI follow-ups are automatic/);
  assert.doesNotMatch(source, /followupTemplates|draft\.followups|Follow up unanswered enquiries/);
});
test('a missing number explains the draft save blocker in the editor', () => {
  assert.match(source, /Connect a WhatsApp number in this workspace before saving the draft/);
  assert.match(source, /role="alert"[^\n]*\{notice\}/);
  assert.match(source, /disabled=\{saving\} onClick=\{save\}/);
});
