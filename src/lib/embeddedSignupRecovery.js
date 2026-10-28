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
  return !completionStarted && Boolean(pending?.code || pending?.completionSubmitted) && Boolean(embeddedSignupCompletionPayload(pending));
}

export function embeddedSignupRecoveryOutcome({ connection, errorMessage = "" }) {
  if (connection?.status === "connected" && connection?.provisioning_state === "operational") return "complete";
  if (connection?.provisioning_state === "registration_confirmation_required" || /needs confirmation before another attempt/i.test(errorMessage)) return "confirmation_required";
  if (connection?.provisioning_state === "registering" || /already in progress/i.test(errorMessage)) return "in_progress";
  if (/session has expired|session is no longer valid/i.test(errorMessage)) return "expired";
  return "recoverable_error";
}

export function pendingSignupStorageKey(workspaceId,userId) {
  return workspaceId&&userId?`zedping.signup.${workspaceId}.${userId}`:null;
}
export function savePendingSignup(storage,key,pending,now=Date.now()) {
  if(!key)return;
  try {
    if(!pending?.session || !pending.completionSubmitted){storage.removeItem(key);return;}
    storage.setItem(key,JSON.stringify({savedAt:now,session:pending.session,phoneNumberId:pending.phoneNumberId,finishWabaId:pending.finishWabaId,completionSubmitted:true}));
  }catch { /* A blocked storage API must not interrupt signup. */ }
}
export function loadPendingSignup(storage,key,now=Date.now()) {
  if(!key)return null;
  try {
    const value=JSON.parse(storage.getItem(key)||'null');
    if(!value || !Number.isFinite(value.savedAt) || value.savedAt>now || now-value.savedAt>24*60*60*1000 || !value.session?.session_id || !value.session?.state || !value.phoneNumberId || value.completionSubmitted!==true){storage.removeItem(key);return null;}
    return {...emptyEmbeddedSignupPending(),session:value.session,phoneNumberId:value.phoneNumberId,finishWabaId:value.finishWabaId||null,completionSubmitted:true};
  }catch{return null;}
}
