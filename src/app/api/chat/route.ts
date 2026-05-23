import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createEmbeddings } from "@/lib/embedding";
import { isAstraVectorEnabled } from "@/lib/astra/config";
import {
  searchAstraClauseChunks,
  searchAstraContractChunks,
} from "@/lib/astra/vector-store";
import { db } from "@/db/drizzle";
import { contractChunks, clauseChunks, clauses, contracts } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { DEFAULT_MODEL, resolveModelProvider } from "@/lib/ai-router";
import { streamText } from "ai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { message, session_id, filters } = await req.json();
    const sourceType = filters?.source_type || "all";

    const sources: { type: string; heading: string }[] = [];
    let contextStr = "";

    if (isAstraVectorEnabled()) {
      if (sourceType === "all" || sourceType === "contract") {
        const [contract] = await db
          .select({ currentVersionId: contracts.currentVersionId })
          .from(contracts)
          .where(eq(contracts.id, session_id))
          .limit(1);

        if (contract?.currentVersionId) {
          const hits = await searchAstraContractChunks({
            contractVersionId: contract.currentVersionId,
            queryText: message,
            limit: 3,
            maxDistance: 0.5,
          });
          for (const res of hits) {
            contextStr += `\n---\nSource: Contract Chunk\nContent: ${res.content}\n`;
            sources.push({ type: "Contract", heading: "Matched Segment" });
          }
        }
      }

      if (sourceType === "all" || sourceType === "library") {
        const orgId = sessionData.session?.activeOrganizationId;
        const workspaceId = sessionData.session?.activeWorkspaceId;
        if (orgId && workspaceId) {
          const hits = await searchAstraClauseChunks({
            queryText: message,
            organizationId: orgId,
            workspaceId: String(workspaceId),
            limit: 3,
            maxDistance: 0.5,
          });
          for (const res of hits) {
            const name = String(res.metadata.clauseName ?? "Library Clause");
            contextStr += `\n---\nSource: Library Clause (${name})\nContent: ${res.content}\n`;
            sources.push({ type: "Library", heading: name });
          }
        }
      }
    } else {
      const [embedding] = await createEmbeddings([message]);
      if (!embedding) {
        return new Response(
          JSON.stringify({ error: "Failed to generate embedding" }),
          { status: 500 },
        );
      }

      const queryVec = sql`${"[" + embedding.join(",") + "]"}::vector`;

      if (sourceType === "all" || sourceType === "contract") {
        const contractResults = await db
          .select({
            content: contractChunks.content,
            id: contractChunks.id,
            similarity: sql<number>`1 - (${contractChunks.embedding} <=> ${queryVec})`,
          })
          .from(contractChunks)
          .where(sql`${contractChunks.embedding} <=> ${queryVec} < 0.5`)
          .orderBy(sql`${contractChunks.embedding} <=> ${queryVec}`)
          .limit(3);

        for (const res of contractResults) {
          contextStr += `\n---\nSource: Contract Chunk\nContent: ${res.content}\n`;
          sources.push({ type: "Contract", heading: "Matched Segment" });
        }
      }

      if (sourceType === "all" || sourceType === "library") {
        const clauseResults = await db
          .select({
            content: clauseChunks.content,
            clauseName: clauses.clauseName,
            similarity: sql<number>`1 - (${clauseChunks.embedding} <=> ${queryVec})`,
          })
          .from(clauseChunks)
          .innerJoin(clauses, eq(clauseChunks.clauseId, clauses.id))
          .where(sql`${clauseChunks.embedding} <=> ${queryVec} < 0.5`)
          .orderBy(sql`${clauseChunks.embedding} <=> ${queryVec}`)
          .limit(3);

        for (const res of clauseResults) {
          contextStr += `\n---\nSource: Library Clause (${res.clauseName})\nContent: ${res.content}\n`;
          sources.push({ type: "Library", heading: res.clauseName });
        }
      }
    }

    const systemPrompt =
      "You are a specialized legal assistant for WordingsAI. Use the provided context to answer questions accurately. If context is missing, say you don't know based on current files. Keep it professional.";
    const userPrompt = `Context:\n${contextStr}\n\nUser Question: ${message}`;

    const { textStream } = await streamText({
      model: resolveModelProvider(DEFAULT_MODEL) as any,
      prompt: userPrompt,
      system: systemPrompt,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`),
        );

        try {
          for await (const token of textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            );
          }
        } catch (err) {
          console.error("[Chat API] Streaming error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
