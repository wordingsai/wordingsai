import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { session, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessWorkspace } from "@/server/workspaces";

export async function POST(req: Request) {
  const authSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!authSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 },
    );
  }

  const organizationId = (authSession.session as any).activeOrganizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 403 },
    );
  }

  const allowed = await canAccessWorkspace(
    authSession.user.id,
    organizationId,
    workspaceId,
  );

  if (!allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const [workspace] = await db
    .select({
      id: workspaces.id,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace || workspace.organizationId !== organizationId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await db
    .update(session)
    .set({ activeWorkspaceId: workspaceId })
    .where(eq(session.id, authSession.session.id));

  return NextResponse.json({ success: true, workspaceId });
}
