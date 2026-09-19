import test from "node:test";
import assert from "node:assert/strict";
import { invitationAccountState } from "../src/lib/invitationIdentity.js";

test("invitation identity treats a matching authenticated email as eligible", () => {
  assert.equal(invitationAccountState("Invitee@Example.com", "invitee@example.com"), "matching_session");
});

test("invitation identity blocks a different authenticated account", () => {
  assert.equal(invitationAccountState("invitee@example.com", "other@example.com"), "different_session");
});

test("invitation identity preserves the unauthenticated path", () => {
  assert.equal(invitationAccountState("invitee@example.com", null), "no_session");
  assert.equal(invitationAccountState(null, "other@example.com"), "none");
});
