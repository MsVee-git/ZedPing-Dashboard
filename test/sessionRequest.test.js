import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionRequest } from '../src/lib/sessionRequest.js';
const session = token => ({ access_token: token, user: { id: 'owner' } });
function harness(status = 401, fail = false) {
  let current = session('old'), refreshes = 0;
  const calls = [];
  const auth = {
    async getSession() { return { data: { session: current } }; },
    async refreshSession() { refreshes++; await new Promise(resolve => setTimeout(resolve, 5)); if (fail) return { error: new Error('expired') }; current = session('new'); return { data: { session: current } }; }
  };
  const send = createSessionRequest(auth, async (url, init) => {
    calls.push({ url, ...init });
    return { status: init.headers.get('Authorization') === 'Bearer new' ? 200 : status };
  });
  return { send, calls, refreshes: () => refreshes };
}
test('expired mobile session refreshes and retries with workspace and body preserved', async () => {
  const h = harness();
  assert.equal((await h.send('/inbox', { method: 'POST', body: 'payload', headers: { 'x-zedping-workspace-id': 'workspace' } })).status, 200);
  assert.equal(h.refreshes(), 1);
  assert.equal(h.calls[1].headers.get('x-zedping-workspace-id'), 'workspace');
  assert.equal(h.calls[1].body, 'payload');
});
test('concurrent inbox requests share a refresh', async () => {
  const h = harness();
  const results = await Promise.all([h.send('/counts'), h.send('/conversations')]);
  assert.ok(results.every(r => r.status === 200));
  assert.equal(h.refreshes(), 1);
});
test('failed refresh returns original rejection without a loop', async () => {
  const h = harness(401, true);
  assert.equal((await h.send('/inbox')).status, 401);
  assert.equal(h.calls.length, 1);
});
test('permissions and server failures do not refresh or retry', async () => {
  for (const status of [200, 403, 500]) {
    const h = harness(status);
    assert.equal((await h.send('/inbox')).status, status);
    assert.equal(h.refreshes(), 0);
    assert.equal(h.calls.length, 1);
  }
});
