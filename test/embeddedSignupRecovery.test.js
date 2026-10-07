import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartEmbeddedSignupCompletion,
  embeddedSignupCompletionPayload,
  embeddedSignupRecoveryOutcome,
  emptyEmbeddedSignupPending
} from "../src/lib/embeddedSignupRecovery.js";

const session = { session_id: "123e4567-e89b-12d3-a456-426614174000", state: "x".repeat(32) };

test("resumes a signed pending session without retaining a one-time authorization code", () => {
  const pending = { session, code: null, phoneNumberId: "123456789", finishWabaId: "987654321" };
  assert.deepEqual(embeddedSignupCompletionPayload(pending), {
    session_id: session.session_id,
    state: session.state,
    phone_number_id: "123456789",
    finish_waba_id: "987654321"
  });
  assert.equal(Object.hasOwn(embeddedSignupCompletionPayload(pending), "code"), false);
});

test("first completion payload includes the transient authorization code only once", () => {
  const pending = { session, code: "temporary-code", phoneNumberId: "123456789", finishWabaId: null };
  const payload = embeddedSignupCompletionPayload(pending);
  pending.code = null;
  assert.equal(payload.code, "temporary-code");
  assert.equal(Object.hasOwn(embeddedSignupCompletionPayload(pending), "code"), false);
});

test("in-progress provisioning is not retried as another Embedded Signup", () => {
  assert.equal(embeddedSignupRecoveryOutcome({ errorMessage: "WhatsApp provisioning is already in progress" }), "in_progress");
  assert.equal(embeddedSignupRecoveryOutcome({ connection: { provisioning_state: "registering" } }), "in_progress");
});

test("duplicate clicks are refused after the first completion request begins", () => {
  const pending = { session, code: null, phoneNumberId: "123456789", finishWabaId: null, completionSubmitted: true };
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), true);
  assert.equal(canStartEmbeddedSignupCompletion(pending, true), false);
});

test("registration confirmation required is explicit and never treated as retryable", () => {
  assert.equal(embeddedSignupRecoveryOutcome({ connection: { provisioning_state: "registration_confirmation_required" } }), "confirmation_required");
  assert.equal(embeddedSignupRecoveryOutcome({ errorMessage: "WhatsApp registration needs confirmation before another attempt." }), "confirmation_required");
});

test("only a confirmed operational response completes and expiry clears the pending session", () => {
  assert.equal(embeddedSignupRecoveryOutcome({ connection: { status: "connected", provisioning_state: "operational" } }), "complete");
  assert.equal(embeddedSignupRecoveryOutcome({ errorMessage: "This connection session has expired. Start again." }), "expired");
  assert.deepEqual(emptyEmbeddedSignupPending(), { session: null, code: null, phoneNumberId: null, finishWabaId: null });
});

test("existing connections remain operational and do not enter a recovery state", () => {
  assert.equal(embeddedSignupRecoveryOutcome({ connection: { status: "connected", provisioning_state: "operational", id: "legacy-connection" } }), "complete");
});

test("FINISH before the login code waits instead of sending an initial code-less completion", () => {
  const pending = { ...emptyEmbeddedSignupPending(), session, phoneNumberId: "123456789" };
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), false);
  pending.code = "temporary-code";
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), true);
  const first = embeddedSignupCompletionPayload(pending);
  pending.completionSubmitted = true;
  pending.code = null;
  assert.equal(first.code, "temporary-code");
  assert.equal(canStartEmbeddedSignupCompletion(pending, true), false);
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), true);
  assert.equal(Object.hasOwn(embeddedSignupCompletionPayload(pending), "code"), false);
});

test("login code before FINISH waits for the selected phone", () => {
  const pending = { ...emptyEmbeddedSignupPending(), session, code: "temporary-code" };
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), false);
  pending.phoneNumberId = "123456789";
  assert.equal(canStartEmbeddedSignupCompletion(pending, false), true);
});
