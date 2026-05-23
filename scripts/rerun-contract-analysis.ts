/**
 * Queue a full contract analysis (document map + checklist + optional rules).
 *
 * Usage:
 *   pnpm analysis:rerun <contractId>
 *   pnpm analysis:rerun c058f8bd-0d36-41e0-9081-40190bf3932b
 */
import "dotenv/config";
import { db } from "../src/db/drizzle";
import { contracts, organization } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "../src/inngest/client";

const contractId = process.argv[2] || "c058f8bd-0d36-41e0-9081-40190bf3932b";

async function main() {
  const [contract] = await db
    .select({
      id: contracts.id,
      contractName: contracts.contractName,
      organizationId: contracts.organizationId,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    console.error(`Contract not found: ${contractId}`);
    process.exit(1);
  }

  const [org] = await db
    .select({ plan: organization.plan })
    .from(organization)
    .where(eq(organization.id, contract.organizationId))
    .limit(1);

  const organizationPlan =
    org?.plan === "plus" || org?.plan === "basic" ? org.plan : "basic";

  await inngest.send({
    name: "contract/evaluate",
    data: {
      contractId: contract.id,
      organizationId: contract.organizationId,
      organizationPlan,
      mode: "full",
      force: true,
    },
  });

  console.log(
    `Queued contract/evaluate (full, force) for "${contract.contractName}" (${contractId})`,
  );
  console.log(`Organization plan: ${organizationPlan}`);
  console.log(
    "Ensure Inngest is running (Vercel deployment or `npx inngest-cli dev`).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
