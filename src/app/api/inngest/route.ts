import { serve } from "inngest/next";
export const dynamic = "force-dynamic";
/** Vercel Hobby max; each Inngest step.run gets its own 60s invocation. */
export const maxDuration = 60;

import { inngest } from "../../../inngest/client";
import {
  evaluateContractRulesJob,
  fastAnalysisJob,
  mainAnalysisJob,
  evaluateRuleJob,
  finalizeAnalysisJob,
  cleanupBinJob,
} from "../../../inngest/functions";
import { syncLibraryClauseJob } from "../../../inngest/jobs/clause-sync";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    evaluateContractRulesJob,
    fastAnalysisJob,
    mainAnalysisJob,
    evaluateRuleJob,
    finalizeAnalysisJob,
    cleanupBinJob,
    syncLibraryClauseJob,
  ],
});
