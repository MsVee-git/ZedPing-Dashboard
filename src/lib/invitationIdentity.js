function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function invitationAccountState(invitedEmail, authenticatedEmail) {
  const invited = normalizeEmail(invitedEmail);
  if (!invited) return "none";
  const authenticated = normalizeEmail(authenticatedEmail);
  if (!authenticated) return "no_session";
  return invited === authenticated ? "matching_session" : "different_session";
}
