import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  canAccessWorkspaceMock,
  limitMock,
  selectMock,
  updateSetMock,
  updateWhereMock,
  updateMock,
} = vi.hoisted(() => {
  const getSessionMock = vi.fn();
  const canAccessWorkspaceMock = vi.fn();
  const limitMock = vi.fn();
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    getSessionMock,
    canAccessWorkspaceMock,
    limitMock,
    selectMock,
    updateSetMock,
    updateWhereMock,
    updateMock,
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
    update: updateMock,
  },
}));

import { POST } from "@/app/api/auth/set-workspace/route";

describe("set-workspace route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      user: { id: "u_1" },
      session: {
        id: "sess_1",
        activeOrganizationId: "org_1",
      },
    });
    canAccessWorkspaceMock.mockResolvedValue(true);
    limitMock.mockResolvedValue([{ id: "ws_1", organizationId: "org_1" }]);
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("rejects missing workspaceId", async () => {
    const req = new Request("http://localhost/api/auth/set-workspace", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects inaccessible workspace", async () => {
    canAccessWorkspaceMock.mockResolvedValueOnce(false);
    const req = new Request("http://localhost/api/auth/set-workspace", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "ws_1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates activeWorkspaceId for accessible workspace", async () => {
    const req = new Request("http://localhost/api/auth/set-workspace", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "ws_1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updateSetMock).toHaveBeenCalledWith({ activeWorkspaceId: "ws_1" });
  });
});
