import { describe, expect, it } from "vitest";
import {
  getControlledGlobalWorkspaceSeeds,
  getGlobalWorkspaceSeedByType,
} from "@/lib/workspace-defaults";
import { assertWorkspaceMutable } from "@/server/workspace-resolver";

describe("workspace isolation primitives", () => {
  it("returns controlled global workspace catalog", () => {
    const seeds = getControlledGlobalWorkspaceSeeds();
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    expect(seeds.some((s) => s.type === "reinsurance")).toBe(true);
    expect(seeds.some((s) => s.type === "property")).toBe(true);
  });

  it("resolves workspace seed case-insensitively", () => {
    const seed = getGlobalWorkspaceSeedByType("Reinsurance");
    expect(seed?.type).toBe("reinsurance");
  });

  it("blocks writes in global workspace context", async () => {
    const result = await assertWorkspaceMutable({
      userId: "u_1",
      organizationId: "org_1",
      workspaceId: "ws_1",
      workspace: {
        id: "ws_1",
        organizationId: "org_1",
        name: "Reinsurance",
        type: "reinsurance",
        isGlobal: true,
        mandatoryRegistry: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});
