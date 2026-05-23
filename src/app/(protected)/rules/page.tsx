import { UpgradePaywall } from "@/components/common/upgrade-paywall";
import { getActiveOrganization } from "@/server/organizations";
import { getCurrentUser } from "@/server/users";
import { redirect } from "next/navigation";
import RulesClient from "./rules-client";

export const revalidate = 0; // Revalidate on every request to always get fresh plan

export default async function RulesPage(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  const { currentUser } = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const organization = await getActiveOrganization(currentUser.id);
  if (!organization) redirect("/dashboard");

  return <RulesClient />;
}
