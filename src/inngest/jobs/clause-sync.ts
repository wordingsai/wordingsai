import { inngest } from "../client";
import { embedSingleClause } from "../../lib/chunk";

export const syncLibraryClauseJob = inngest.createFunction(
  {
    id: "sync-library-clause",
    triggers: [{ event: "clause/sync" }],
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const { clauseId } = event.data as { clauseId: string };

    await step.run("embed-clause", async () => {
      await embedSingleClause(clauseId);
    });

    return { success: true, clauseId };
  },
);
