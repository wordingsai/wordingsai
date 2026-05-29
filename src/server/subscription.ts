import { getActiveOrganization } from "@/server/organizations";

// Plan tiers (id -> Richard's product name):
//   fast       -> "Fast"          read-only: core library, no custom clauses, no rules
//   basic      -> "Intelligence"  custom clauses + analytics, but NO rules
//   plus       -> "Plus"          full: custom clauses + rules + deep analytics
//   enterprise -> superset of Plus
export type OrganizationPlan = "fast" | "basic" | "plus" | "enterprise";

export async function getActiveOrganizationPlan(
  userId: string,
  preferredOrgId?: string | null,
): Promise<OrganizationPlan | null> {
  const org = await getActiveOrganization(userId, preferredOrgId);
  return (org?.plan as OrganizationPlan | undefined) ?? null;
}

export async function requirePlusPlan(
  userId: string,
  preferredOrgId?: string | null,
) {
  const org = await getActiveOrganization(userId, preferredOrgId);
  if (!org) {
    return {
      ok: false as const,
      status: 403 as const,
      reason: "no_org" as const,
    };
  }
  if (org.plan !== "plus") {
    return {
      ok: false as const,
      status: 403 as const,
      reason: "upgrade_required" as const,
      organizationId: org.id,
      plan: org.plan as OrganizationPlan,
    };
  }
  return {
    ok: true as const,
    organizationId: org.id,
    plan: org.plan as OrganizationPlan,
  };
}

/**
 * Gate for customization features that the Intelligence tier unlocks —
 * principally adding/editing custom clauses. Allowed on Intelligence
 * (basic), Plus and Enterprise; blocked only on the read-only Fast tier.
 * Rules remain Plus-only via requirePlusPlan.
 */
export async function requireCustomizationPlan(
  userId: string,
  preferredOrgId?: string | null,
) {
  const org = await getActiveOrganization(userId, preferredOrgId);
  if (!org) {
    return {
      ok: false as const,
      status: 403 as const,
      reason: "no_org" as const,
    };
  }
  if (!org.plan || org.plan === "fast") {
    return {
      ok: false as const,
      status: 403 as const,
      reason: "upgrade_required" as const,
      organizationId: org.id,
      plan: (org.plan as OrganizationPlan) ?? null,
    };
  }
  return {
    ok: true as const,
    organizationId: org.id,
    plan: org.plan as OrganizationPlan,
  };
}
