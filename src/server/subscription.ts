import { getActiveOrganization } from "@/server/organizations";

export type OrganizationPlan = "basic" | "plus";

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
