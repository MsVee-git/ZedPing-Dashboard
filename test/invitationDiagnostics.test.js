import test from "node:test";
import assert from "node:assert/strict";
import { invitationAuthDiagnostic } from "../src/lib/invitationDiagnostics.js";

test("invitation diagnostics permit only safe fixed event names", () => {
  assert.deepEqual(invitationAuthDiagnostic("no_session"), { event_name: "no_session" });
  assert.deepEqual(invitationAuthDiagnostic("accept_attempted"), { event_name: "accept_attempted" });
});

test("invitation diagnostics reject values that could carry sensitive data", () => {
  assert.equal(invitationAuthDiagnostic("token=secret"), null);
  assert.equal(invitationAuthDiagnostic("email@example.com"), null);
  assert.equal(invitationAuthDiagnostic("unknown"), null);
});
