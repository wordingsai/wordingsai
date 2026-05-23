"use server";

import { db } from "@/db/drizzle";
import {
  workspaces,
  workspaceAccess,
  rules,
  ruleVersions,
  clauses,
  clauseVersions,
} from "@/db/schema";
import { getCurrentUser } from "./users";
import { getActiveOrganization } from "./organizations";
import { eq, and } from "drizzle-orm";
import { getGlobalWorkspaceSeedByType } from "@/lib/workspace-defaults";
import { canAccessWorkspace } from "./workspaces";

export async function createWorkspace(
  name: string,
  type: string,
  mode: "scratch" | "duplicate" = "scratch",
  sourceWorkspaceId?: string,
) {
  const { currentUser } = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const org = await getActiveOrganization(currentUser.id);
  if (!org) throw new Error("No organization found");

  if (org.plan !== "plus") {
    throw new Error(
      "Only Plus plan organizations can create custom workspaces. Upgrade to Plus to unlock multi-workspace support.",
    );
  }

  return await db.transaction(async (tx) => {
    // Find default registry for this type if creating from scratch
    const defaultWS = getGlobalWorkspaceSeedByType(type);

    // 1. Create the workspace
    let initialRegistry =
      mode === "scratch" ? defaultWS?.mandatoryRegistry || [] : [];

    if (mode === "duplicate" && sourceWorkspaceId) {
      const [sourceWS] = await tx
        .select({
          id: workspaces.id,
          organizationId: workspaces.organizationId,
          mandatoryRegistry: workspaces.mandatoryRegistry,
        })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.id, sourceWorkspaceId),
            eq(workspaces.organizationId, org.id),
          ),
        )
        .limit(1);
      if (!sourceWS)
        throw new Error("Source workspace not found in active organization.");
      const allowed = await canAccessWorkspace(
        currentUser.id,
        org.id,
        sourceWS.id,
      );
      if (!allowed) throw new Error("Access denied to source workspace.");
      initialRegistry = (sourceWS.mandatoryRegistry as any[]) || [];
    }

    const workspaceResult = (await tx
      .insert(workspaces)
      .values({
        name,
        organizationId: org.id,
        type,
        isGlobal:
          mode === "scratch" &&
          type !== "property" &&
          defaultWS?.isGlobal === true
            ? true
            : false,
        mandatoryRegistry: initialRegistry,
      })
      .returning()) as any[];
    const workspace = workspaceResult[0];

    // 2. Grant access
    await tx.insert(workspaceAccess).values({
      workspaceId: workspace.id,
      userId: currentUser.id,
      role: "admin",
    });

    // 3. Handle Duplication Mode
    if (mode === "duplicate" && sourceWorkspaceId) {
      console.log(
        `[Workspace] Duplicating data from ${sourceWorkspaceId} to ${workspace.id}`,
      );

      // Copy Rules
      const sourceRules = await tx
        .select()
        .from(rules)
        .where(
          and(
            eq(rules.workspaceId, sourceWorkspaceId),
            eq(rules.organizationId, org.id),
          ),
        );

      for (const rule of sourceRules) {
        const newRuleResult = (await tx
          .insert(rules)
          .values({
            name: rule.name,
            description: rule.description,
            category: rule.category,
            isGlobal: false,
            organizationId: org.id,
            workspaceId: workspace.id,
            status: rule.status,
            createdBy: currentUser.id,
          })
          .returning()) as any[];
        const newRule = newRuleResult[0];

        // Copy Rule Versions
        const versions = await tx
          .select()
          .from(ruleVersions)
          .where(eq(ruleVersions.ruleId, rule.id))
          .orderBy(ruleVersions.versionNumber);

        for (const version of versions) {
          const newVersionResult = (await tx
            .insert(ruleVersions)
            .values({
              ruleId: newRule.id,
              versionNumber: version.versionNumber,
              ruleDefinition: version.ruleDefinition,
            })
            .returning()) as any[];
          const newVersion = newVersionResult[0];

          if (version.id === rule.currentVersionId) {
            await tx
              .update(rules)
              .set({ currentVersionId: newVersion.id })
              .where(eq(rules.id, newRule.id));
          }
        }
      }

      // Copy Clauses
      const sourceClauses = await tx
        .select()
        .from(clauses)
        .where(
          and(
            eq(clauses.workspaceId, sourceWorkspaceId),
            eq(clauses.organizationId, org.id),
          ),
        );

      for (const clause of sourceClauses) {
        const newClauseResult = (await tx
          .insert(clauses)
          .values({
            organizationId: org.id,
            workspaceId: workspace.id,
            isGlobal: false,
            clauseName: clause.clauseName,
            category: clause.category,
            clauseText: clause.clauseText,
            heading: clause.heading,
            source: clause.source,
            library: clause.library,
            aiSummary: clause.aiSummary,
            aiFavorability: clause.aiFavorability,
            aiRecommendedUse: clause.aiRecommendedUse,
            aiNote: clause.aiNote,
            keywords: clause.keywords,
            metadata: clause.metadata,
          })
          .returning()) as any[];
        const newClause = newClauseResult[0];

        // Copy Clause Versions
        const versions = await tx
          .select()
          .from(clauseVersions)
          .where(eq(clauseVersions.clauseId, clause.id))
          .orderBy(clauseVersions.versionNumber);

        for (const version of versions) {
          await tx.insert(clauseVersions).values({
            clauseId: newClause.id,
            versionNumber: version.versionNumber,
            clauseText: version.clauseText,
            heading: version.heading,
            source: version.source,
            aiSummary: version.aiSummary,
            aiFavorability: version.aiFavorability,
            aiRecommendedUse: version.aiRecommendedUse,
            aiNote: version.aiNote,
            keywords: version.keywords,
            changedByName: version.changedByName,
            changeNote: `Copied from workspace ${sourceWorkspaceId}`,
          });
        }
      }
    }

    return workspace;
  });
}

export async function reinitializeWorkspace(workspaceId: string) {
  const { currentUser } = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) throw new Error("Workspace not found");

  const org = await getActiveOrganization(currentUser.id);
  if (!org || workspace.organizationId !== org.id) {
    throw new Error("Unauthorized");
  }

  return await db.transaction(async (tx) => {
    // 1. Purge rules and clauses specific to this workspace
    await tx.delete(rules).where(eq(rules.workspaceId, workspaceId));
    await tx.delete(clauses).where(eq(clauses.workspaceId, workspaceId));

    // 2. Reset mandatory registry based on type
    const defaultWS = getGlobalWorkspaceSeedByType(workspace.type);
    await tx
      .update(workspaces)
      .set({ mandatoryRegistry: defaultWS?.mandatoryRegistry || [] })
      .where(eq(workspaces.id, workspaceId));

    return { success: true };
  });
}
