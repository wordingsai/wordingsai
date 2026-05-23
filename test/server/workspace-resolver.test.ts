import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, canAccessWorkspaceMock, limitMock, selectMock } =
  vi.hoisted(() => {
    const getSessionMock = vi.fn();
    const canAccessWorkspaceMock = vi.fn();
    const limitMock = vi.fn();
    const whereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));

    return {
      getSessionMock,
      canAccessWorkspaceMock,
      limitMock,
      selectMock,
    };
  });

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/server/workspaces", () => ({
  canAccessWorkspace: canAccessWorkspaceMock,
}));

vi.mock("@/db/drizzle", () => ({
  db: {
    select: selectMock,
  },
}));

import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

describe("workspace resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([]);
  });

  it("returns unauthorized when session user is missing", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const result = await resolveActiveWorkspaceContext();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("returns bad request when active workspace is missing", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "u_1" },
      session: { activeOrganizationId: "org_1" },
    });

    const result = await resolveActiveWorkspaceContext();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("returns forbidden when workspace access is denied", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "u_1" },
      session: {
        activeOrganizationId: "org_1",
        activeWorkspaceId: "ws_1",
      },
    });
    canAccessWorkspaceMock.mockResolvedValueOnce(false);

    const result = await resolveActiveWorkspaceContext();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("returns not found when workspace record is missing", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "u_1" },
      session: {
        activeOrganizationId: "org_1",
        activeWorkspaceId: "ws_1",
      },
    });
    canAccessWorkspaceMock.mockResolvedValueOnce(true);
    limitMock.mockResolvedValueOnce([]);

    const result = await resolveActiveWorkspaceContext();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("returns resolved context for accessible workspace", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "u_1" },
      session: {
        activeOrganizationId: "org_1",
        activeWorkspaceId: "ws_1",
      },
    });
    canAccessWorkspaceMock.mockResolvedValueOnce(true);
    limitMock.mockResolvedValueOnce([
      {
        id: "ws_1",
        organizationId: "org_1",
        name: "Custom Workspace",
        type: "reinsurance",
        isGlobal: false,
      },
    ]);

    const result = await resolveActiveWorkspaceContext();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.workspaceId).toBe("ws_1");
      expect(result.context.organizationId).toBe("org_1");
    }
  });
});
