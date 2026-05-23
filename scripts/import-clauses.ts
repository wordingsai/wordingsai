import "dotenv/config";
import { db } from "../src/db/drizzle";
import { clauses } from "../src/db/schema";
import { eq, or } from "drizzle-orm";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const ORG_ID = "c7BkNsHuGpIKHyEcrmgbySSP76uExuwf";

// Paths from the public folder
const CORE_CSV =
  "public/core/ExportBlock-2bcf9cf2-822d-4ffd-8bbb-86299d9d032e-Part-1/Reinsurance - Core Clause Library 7bbf0230893d4ede8b8e28cc49f675fb.csv";
const CUSTOM_CSV =
  "public/custom/ExportBlock-93e12aa2-4479-45d7-9da7-c7d3fa55de7a-Part-1/Reinsurance — Custom Clause Library 4f87c4c496fc42feb495a31e56637024.csv";

type ClauseCSV = {
  "Clause Identification": string;
  Code: string;
  "Clause Category": string;
  "Source Library": string;
  Status: string;
  Scope: string;
  "Line of Business": string;
  "Clause Text": string;
  "Created time": string;
};

const CATEGORY_MAP: Record<string, any> = {
  Exclusions: "Exclusions",
  Claims: "Claims",
  "Premium & Payments": "Premium & Payments",
  "Placement & Subscription": "Placement & Subscription",
  Compliance: "Compliance",
  "Information & Records": "Information & Records",
  Disputes: "Disputes",
  "Parties & Definitions": "Parties & Definitions",
  Termination: "Termination",
  Other: "Other",
};

async function importLibrary(
  filePath: string,
  isGlobal: boolean,
  orgId: string | null,
) {
  console.log(`Importing ${filePath}...`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const csvFile = fs.readFileSync(filePath, "utf8");

  const results = Papa.parse<ClauseCSV>(csvFile, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`Found ${results.data.length} rows.`);

  let successCount = 0;
  let failCount = 0;

  for (const row of results.data) {
    const name = row["Clause Identification"];
    const text = row["Clause Text"];
    const category = CATEGORY_MAP[row["Clause Category"]] || "Other";
    const library = row["Source Library"] || (isGlobal ? "Core" : "Custom");

    // Default to Approved as per schema requirement for not null
    const status = "Approved";

    if (!name || !text) {
      // console.warn(`Skipping row with missing name or text: ${name}`);
      failCount++;
      continue;
    }

    try {
      await db.insert(clauses).values({
        clauseName: name,
        clauseText: text,
        category: category,
        isGlobal: isGlobal,
        organizationId: orgId,
        library: library,
        source: row["Code"],
        status: status,
        approvalStatus: "Approved",
        keywords: [name, row["Code"]].filter(Boolean),
        metadata: {
          lineOfBusiness: row["Line of Business"],
          originalScope: row["Scope"],
          createdTime: row["Created time"],
        },
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to insert clause ${name}:`, err);
      failCount++;
    }
  }

  console.log(
    `Import complete for ${filePath}. Success: ${successCount}, Failed: ${failCount}`,
  );
}

async function main() {
  try {
    console.log("Starting Clause Library sync...");

    // 1. Clear existing clauses to avoid duplicates
    console.log("Cleaning up old clauses (Global + Org specific)...");
    await db
      .delete(clauses)
      .where(
        or(eq(clauses.isGlobal, true), eq(clauses.organizationId, ORG_ID)),
      );
    console.log("Cleanup finished.");

    // 2. Import Core (Global)
    await importLibrary(CORE_CSV, true, null);

    // 3. Import Custom (Private to Org)
    await importLibrary(CUSTOM_CSV, false, ORG_ID);

    console.log("All imports finished successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Main import error:", err);
    process.exit(1);
  }
}

main();
