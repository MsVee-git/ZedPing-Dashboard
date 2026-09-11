import test from "node:test";
import assert from "node:assert/strict";
import { provisionWorkspaceWithGateway } from "../src/lib/workspaceProvisioning.js";

const user = {
  id: "test-user-id",
  email: "owner@example.test",
  user_metadata: { business_name: "Example Business", phone: "+260700000000" }
};

test("provisions one workspace and one owner membership for a new owner", async () => {
  const calls = { create: 0, membership: 0 };
  const workspace = { id: "workspace-1", auth_user_id: user.id };

  const result = await provisionWorkspaceWithGateway({
    findOwnedWorkspace: async () => null,
    findMemberships: async () => [],
    createWorkspace: async (seed) => {
      calls.create += 1;
      assert.equal(seed.email, user.email);
      return workspace;
    },
    ensureOwnerMembership: async (customerId, userId) => {
      calls.membership += 1;
      assert.equal(customerId, workspace.id);
      assert.equal(userId, user.id);
    }
  }, user);

  assert.equal(result, workspace);
  assert.deepEqual(calls, { create: 1, membership: 1 });
});

test("does not provision an owner workspace for an invited member", async () => {
  let created = false;
  const result = await provisionWorkspaceWithGateway({
    findOwnedWorkspace: async () => null,
    findMemberships: async () => [{ customer_id: "invited-workspace" }],
    createWorkspace: async () => { created = true; },
    ensureOwnerMembership: async () => assert.fail("must not create membership")
  }, user);

  assert.equal(result, null);
  assert.equal(created, false);
});

test("only retries a duplicate Auth-user identity conflict", async () => {
  const workspace = { id: "workspace-1", auth_user_id: user.id };
  let lookups = 0;
  const result = await provisionWorkspaceWithGateway({
    findOwnedWorkspace: async () => {
      lookups += 1;
      return lookups === 1 ? null : workspace;
    },
    findMemberships: async () => [],
    createWorkspace: async () => {
      throw { code: "23505", constraint: "customers_auth_user_id_unique" };
    },
    ensureOwnerMembership: async () => {}
  }, user);

  assert.equal(result, workspace);
});

test("does not treat an email collision as ownership", async () => {
  await assert.rejects(
    provisionWorkspaceWithGateway({
      findOwnedWorkspace: async () => null,
      findMemberships: async () => [],
      createWorkspace: async () => {
        throw { code: "23505", constraint: "customers_email_key" };
      },
      ensureOwnerMembership: async () => {}
    }, user),
    (error) => error.constraint === "customers_email_key"
  );
});
