import test from 'node:test';
import assert from 'node:assert/strict';
import { embeddedSignupLoginOptions } from '../src/lib/embeddedSignupProvider.js';

test('Gupshup launch matches the partner-hosted guide exactly', () => {
  assert.deepEqual(embeddedSignupLoginOptions('654321', { provider: 'gupshup', solution_id: '123456' }), {
    config_id: '654321', response_type: 'code', override_default_response_type: true,
    extras: { setup: { solutionID: '123456' }, featureType: '', sessionInfoVersion: '3' }
  });
  assert.deepEqual(embeddedSignupLoginOptions('654321', { provider: 'meta' }).extras, { version: 'v4' });
});

test('invalid or mismatched deployment settings cannot launch Meta signup', () => {
  const session = { provider: 'gupshup', solution_id: '123456', meta_app_id: '765432', meta_config_id: '654321' };
  assert.doesNotThrow(() => embeddedSignupLoginOptions('654321', session, '765432'));
  assert.throws(() => embeddedSignupLoginOptions('654321', session, '111111'), /do not match/);
  assert.throws(() => embeddedSignupLoginOptions('222222', session, '765432'), /do not match/);
  assert.throws(() => embeddedSignupLoginOptions('bad', session, '765432'), /invalid/);
  assert.throws(() => embeddedSignupLoginOptions('654321', { provider: 'gupshup' }), /incomplete/);
});
