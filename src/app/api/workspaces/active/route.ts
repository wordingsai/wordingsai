import { NextResponse } from "next/server";
import { resolveActiveWorkspaceContext } from "@/server/workspace-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await resolveActiveWorkspaceContext();
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const { context } = resolved;
  return NextResponse.json({
    workspaceId: context.workspaceId,
    name: context.workspace.name,
    type: context.workspace.type,
    isGlobal: context.workspace.isGlobal,
    isMutable: !context.workspace.isGlobal,
  });
}
