export const INVITATION_STORAGE_KEY = "zedping.pendingInvitationToken";

export function extractInvitationToken(hash = "") {
  const match = String(hash).match(/(?:^#|[?&])invite=([^&]+)/);
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return token || null;
  } catch {
    return null;
  }
}

export function captureInvitationToken(storage, hash = "") {
  const fromLink = extractInvitationToken(hash);
  if (fromLink) {
    storage.setItem(INVITATION_STORAGE_KEY, fromLink);
    return fromLink;
  }
  return storage.getItem(INVITATION_STORAGE_KEY) || null;
}

export function clearInvitationToken(storage) {
  storage.removeItem(INVITATION_STORAGE_KEY);
}
