export const EMPTY_EMBEDDED_SIGNUP_PENDING = Object.freeze({
  session: null,
  code: null,
  phoneNumberId: null,
  finishWabaId: null
});

export function emptyEmbeddedSignupPending() {
  return { ...EMPTY_EMBEDDED_SIGNUP_PENDING };
}

// The authorization code is included only for its first hand-off to the
// backend. The backend stores the exchanged credential in its server-only
// vault, so a later retry can use the same signed session without this code.
export function embeddedSignupCompletionPayload(pending) {
  if (!pending?.session?.session_id || !pending?.session?.state || !pending?.phoneNumberId) return null;
  return {
    session_id: pending.session.session_id,
    state: pending.session.state,
    ...(typeof pending.code === "string" && pending.code ? { code: pending.code } : {}),
    phone_number_id: pending.phoneNumberId,
    ...(pending.finishWabaId ? { finish_waba_id: pending.finishWabaId } : {})
  };
}

export function canStartEmbeddedSignupCompletion(pending, completionStarted) {
  return !completionStarted && Boolean(embeddedSignupCompletionPayload(pending));
}

export function embeddedSignupRecoveryOutcome({ connection, errorMessage = "" }) {
  if (connection?.status === "connected" && connection?.provisioning_state === "operational") return "complete";
  if (connection?.provisioning_state === "registration_confirmation_required" || /needs confirmation before another attempt/i.test(errorMessage)) return "confirmation_required";
  if (connection?.provisioning_state === "registering" || /already in progress/i.test(errorMessage)) return "in_progress";
  if (/session has expired|session is no longer valid/i.test(errorMessage)) return "expired";
  return "recoverable_error";
}
