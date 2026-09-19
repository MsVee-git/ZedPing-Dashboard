const ALLOWED_EVENTS = new Set([
  "no_session",
  "initial_session",
  "signed_in",
  "email_unverified",
  "invitation_previewed",
  "accept_attempted"
]);

export function invitationAuthDiagnostic(eventName) {
  if (!ALLOWED_EVENTS.has(eventName)) return null;
  return { event_name: eventName };
}

export function emitInvitationAuthDiagnostic(eventName) {
  const detail = invitationAuthDiagnostic(eventName);
  if (!detail || typeof window === "undefined") return detail;
  window.dispatchEvent(new CustomEvent("zedping:invitation-auth-state", { detail }));
  // This log intentionally contains only the fixed event name. It helps a
  // controlled live test distinguish session establishment from invitation use.
  console.info("[ZedPing invitation auth]", detail);
  return detail;
}
