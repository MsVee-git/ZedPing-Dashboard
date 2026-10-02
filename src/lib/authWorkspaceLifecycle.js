// Reuse only an already verified workspace for the same authenticated identity.
// This controls UI lifecycle; every API request still enforces server authorization.
export function canReuseAuthenticatedWorkspace(event, user, loadedIdentity) {
  return ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)
    && Boolean(user?.id && user?.email_confirmed_at && loadedIdentity)
    && user.id === loadedIdentity.id
    && user.email_confirmed_at === loadedIdentity.emailConfirmedAt;
}
