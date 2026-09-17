import test from "node:test";
import assert from "node:assert/strict";
import {
  INVITATION_STORAGE_KEY,
  captureInvitationToken,
  clearInvitationToken,
  extractInvitationToken
} from "../src/lib/invitationFlow.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("captures an invitation token from a fragment for authentication hand-off", () => {
  const session = storage();
  assert.equal(captureInvitationToken(session, "#invite=secure%2Dtoken"), "secure-token");
  assert.equal(session.getItem(INVITATION_STORAGE_KEY), "secure-token");
});

test("keeps a pending invitation through a refresh with no fragment", () => {
  const session = storage();
  session.setItem(INVITATION_STORAGE_KEY, "pending-token");
  assert.equal(captureInvitationToken(session, ""), "pending-token");
});

test("does not accept malformed fragment encoding as an invitation", () => {
  assert.equal(extractInvitationToken("#invite=%E0%A4%A"), null);
});

test("clears the hand-off token only after acceptance", () => {
  const session = storage();
  session.setItem(INVITATION_STORAGE_KEY, "pending-token");
  clearInvitationToken(session);
  assert.equal(session.getItem(INVITATION_STORAGE_KEY), null);
});
