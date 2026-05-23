import { getActiveOrganization } from "@/server/organizations";
import { getCurrentUser } from "@/server/users";
import { revalidatePath } from "next/cache";
import ClauseLibraryClient from "./ClauseLibraryClient";
import { UpgradePaywall } from "@/components/common/upgrade-paywall";
import { redirect } from "next/navigation";

export const revalidate = 0; // Revalidate on every request to always get fresh plan

export default async function ClauseLibraryPage(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  const { currentUser } = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const organization = await getActiveOrganization(currentUser.id);
  if (!organization) redirect("/dashboard");

  return <ClauseLibraryClient organization={organization} />;
}
