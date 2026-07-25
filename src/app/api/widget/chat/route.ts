import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/database";
import { folders, files } from "@/db/schema";
import { retrieveContext, retrieveExtractiveAnswer, buildSystemPrompt } from "@/lib/rag";
import { streamTextWithFallback, ANSWER_MODE } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Public, unauthenticated endpoint — cap requests per token+IP to prevent
// abuse of LLM/embedding compute.
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute

function getDescendantIds(
  allFolders: { id: string; parentId: string | null }[],
  rootId: string,
): string[] {
  const ids = [rootId];
  for (const f of allFolders) {
    if (f.parentId === rootId) {
      ids.push(...getDescendantIds(allFolders, f.id));
    }
  }
  return ids;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { token, query, messages = [] } = body ?? {};

  if (!token || !query?.trim()) {
    return Response.json({ error: "Missing token or query" }, { status: 400, headers: CORS });
  }

  const limit = rateLimit(`widget:${token}:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...CORS, "Retry-After": String(limit.retryAfter) } },
    );
  }

  const [folder] = await db
    .select({ id: folders.id, userId: folders.userId })
    .from(folders)
    .where(eq(folders.widgetToken, token))
    .limit(1);

  if (!folder) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: CORS });
  }

  const allFolders = await db
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, folder.userId));

  const folderIds = getDescendantIds(allFolders, folder.id);

  const folderFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        inArray(files.folderId, folderIds),
        eq(files.userId, folder.userId),
        eq(files.status, "ready"),
      ),
    );

  const fileIds = folderFiles.map((f) => f.id);

  const encoder = new TextEncoder();

  // No ready files — stream a helpful message without running RAG
  if (fileIds.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", data: [] })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: "There are no documents ready in this folder yet. Please upload and process some documents first." })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
    });
  }

  const coreMessages = (messages as { role: string; content: string }[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  coreMessages.push({ role: "user", content: query });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Retrieval and generation run inside the stream so any provider/DB
        // failure degrades to a streamed error event rather than a hard 500.
        if (ANSWER_MODE === "extractive") {
          const { answer, sources } = await retrieveExtractiveAnswer(query, folder.userId, {
            fileIds,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", data: sources })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: answer })}\n\n`));
        } else {
          const { context, sources } = await retrieveContext(query, folder.userId, {
            fileIds,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", data: sources })}\n\n`));

          const { textStream } = await streamTextWithFallback({
            system: buildSystemPrompt(context),
            messages: coreMessages,
          });

          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`));
          }
        }
      } catch (err) {
        console.error("[/api/widget/chat] stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: "Sorry — I couldn't generate a response right now. Please try again." })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...CORS,
    },
  });
}
