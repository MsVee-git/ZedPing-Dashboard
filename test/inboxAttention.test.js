import test from 'node:test';
import assert from 'node:assert/strict';
import { inboxAttentionReasons } from '../src/lib/inboxAttention.js';

test('attention reasons persist after reading and disappear after replying or clearing the callback', () => {
  const now = Date.parse('2026-11-09T10:00:00Z');
  const row = { status: 'open', control_mode: 'human', unread_count: 0, last_inbound_at: '2026-11-09T09:00:00Z', callback_due_at: '2026-11-09T10:00:00Z' };
  assert.deepEqual(inboxAttentionReasons(row, now), ['Awaiting reply', 'Callback due']);
  assert.deepEqual(inboxAttentionReasons({ ...row, last_outbound_at: '2026-11-09T09:30:00Z', callback_due_at: null }, now), []);
  assert.deepEqual(inboxAttentionReasons({ ...row, status: 'resolved' }, now), ['Callback due']);
  assert.deepEqual(inboxAttentionReasons({ status: 'needs_attention', control_mode: 'needs_attention', callback_due_at: '2026-11-09T10:01:00Z' }, now), ['Team handoff']);
});
