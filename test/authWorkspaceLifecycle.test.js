import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { canReuseAuthenticatedWorkspace } from '../src/lib/authWorkspaceLifecycle.js';

const user = { id: 'owner', email_confirmed_at: '2026-09-01' };
const identity = { id: user.id, emailConfirmedAt: user.email_confirmed_at };

function authHarness(loaded = identity) {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const marker = 'supabase.auth.onAuthStateChange((event, session) => {';
  const body = source.split(marker)[1].split('\n    });')[0];
  assert.ok(body, 'load the actual App auth callback');
  const calls = [];
  const timers = [];
  const context = {
    canReuseAuthenticatedWorkspace,
    loadedAuthIdentityRef: { current: loaded },
    window: { setTimeout: fn => timers.push(fn), history: { replaceState() {} }, location: { pathname: '/settings' } },
    emitInvitationAuthDiagnostic() {},
    loadAuthenticatedContext: u => calls.push(['loadWorkspace', u.id])
  };
  for (const key of ['setReset', 'setUser', 'setCustomer', 'setWorkspaces', 'setNeedsVerification', 'setWorkspaceChanging', 'setWorkspaceSwitchTarget', 'setInvitationAccountMismatch']) {
    context[key] = value => calls.push([key, value]);
  }
  vm.createContext(context);
  const callback = vm.runInContext(`(event, session) => {${body}\n}`, context);
  return { callback, calls, timers, context };
}

for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION']) {
  test(`${event} preserves a loaded workspace and the mounted signup component`, () => {
    const h = authHarness();
    h.callback(event, { user });
    assert.equal(h.timers.length, 0);
    assert.deepEqual(h.calls, [['setUser', user]]);
  });
}

test('first login still loads and validates workspace', () => {
  const h = authHarness(null);
  h.callback('SIGNED_IN', { user });
  assert.equal(h.timers.length, 1);
  h.timers[0]();
  assert.deepEqual(h.calls, [['loadWorkspace', 'owner']]);
});

test('a different account must reload workspace', () => {
  const h = authHarness();
  h.callback('SIGNED_IN', { user: { ...user, id: 'another-owner' } });
  h.timers[0]();
  assert.deepEqual(h.calls, [['loadWorkspace', 'another-owner']]);
});

test('user updates and verification changes still reload workspace', () => {
  for (const [event, nextUser] of [['USER_UPDATED', user], ['SIGNED_IN', { ...user, email_confirmed_at: '2026-10-02' }], ['SIGNED_IN', { ...user, email_confirmed_at: null }]]) {
    const h = authHarness();
    h.callback(event, { user: nextUser });
    assert.equal(h.timers.length, 1);
  }
});

test('signout clears both identity cache and workspace UI', () => {
  const h = authHarness();
  h.callback('SIGNED_OUT', null);
  assert.equal(h.context.loadedAuthIdentityRef.current, null);
  assert.ok(h.calls.some(([name, value]) => name === 'setCustomer' && value === null));
  h.callback('SIGNED_IN', { user });
  assert.equal(h.timers.length, 1, 'signing back in validates again');
});

test('password recovery retains its dedicated flow and invalidates cache', () => {
  const h = authHarness();
  h.callback('PASSWORD_RECOVERY', { user });
  assert.equal(h.context.loadedAuthIdentityRef.current, null);
  assert.deepEqual(h.calls, [['setReset', true], ['setUser', null]]);
  assert.equal(h.timers.length, 0);
});
