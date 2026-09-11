export function isAuthUserProvisioningConflict(error) {
  return error?.code === "23505" && error?.constraint === "customers_auth_user_id_unique";
}

export function workspaceSeed(user, details = {}) {
  const metadata = user?.user_metadata || {};
  const business_name = details.business_name || metadata.business_name;
  if (!business_name) return null;

  return {
    auth_user_id: user.id,
    business_name,
    email: user.email,
    phone: details.phone || metadata.phone || null,
    subscription_plan: details.subscription_plan || metadata.subscription_plan || "business",
    subscription_status: "trial"
  };
}

/**
 * Provision exactly one initial owner workspace for a new user. The caller
 * supplies database operations so browser code never decides tenancy itself.
 */
export async function provisionWorkspaceWithGateway(gateway, user, details = {}) {
  const ownedWorkspace = await gateway.findOwnedWorkspace(user.id);
  if (ownedWorkspace) {
    await gateway.ensureOwnerMembership(ownedWorkspace.id, user.id);
    return ownedWorkspace;
  }

  const memberships = await gateway.findMemberships(user.id);
  if (memberships?.length) return null;

  const seed = workspaceSeed(user, details);
  if (!seed) return null;

  let workspace;
  try {
    workspace = await gateway.createWorkspace(seed);
  } catch (error) {
    // Only the unique Auth-user identity represents a concurrent retry.
    // Never infer ownership from an email collision or another constraint.
    if (!isAuthUserProvisioningConflict(error)) throw error;
    workspace = await gateway.findOwnedWorkspace(user.id);
    if (!workspace) throw error;
  }

  await gateway.ensureOwnerMembership(workspace.id, user.id);
  return workspace;
}
