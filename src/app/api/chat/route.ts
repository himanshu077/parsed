import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isTextUIPart,
} from "ai";
import type { UIMessage, ModelMessage } from "ai";
import { auth } from "@/lib/auth";
import { retrieveContext, retrieveExtractiveAnswer, buildSystemPrompt } from "@/lib/rag";
import { streamTextWithFallback, ANSWER_MODE } from "@/lib/ai";
import { db } from "@/lib/database";
import { chats, chatMessages } from "@/db/schema";

const MAX_HISTORY_MESSAGES = 8;

/**
 * Ensures a chat record exists (creating it if needed) and persists the user's
 * message. Returns the resolved chat id.
 */
async function ensureChatAndSaveUserMessage(
  userId: string,
  query: string,
  chatId?: string,
  edited = false,
): Promise<string> {
  let id = chatId;
  if (id) {
    const existing = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(chats).values({ id, userId, title: query.slice(0, 100) });
    }
  } else {
    const [newChat] = await db
      .insert(chats)
      .values({ userId, title: query.slice(0, 100) })
      .returning();
    id = newChat.id;
  }
  await db.insert(chatMessages).values({
    chatId: id!,
    role: "user",
    content: query,
    editedAt: edited ? new Date() : null,
  });
  return id!;
}

/**
 * Deletes the N most-recent messages of a chat. Called when a user edits a prior
 * message: the edited message and everything after it (always the newest N) are
 * removed before the edited turn is re-saved and regenerated — kept atomic on the
 * server so the client never shows a torn/blank intermediate state.
 */
async function deleteLastMessages(
  chatId: string,
  userId: string,
  n: number,
): Promise<void> {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);
  if (!chat) return;

  const recent = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(n);

  if (recent.length > 0) {
    await db.delete(chatMessages).where(
      inArray(
        chatMessages.id,
        recent.map((r) => r.id),
      ),
    );
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    messages?: UIMessage[];
    fileIds?: string[];
    chatId?: string;
    deleteLast?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, fileIds, chatId, deleteLast } = body;
  const isEdit = typeof deleteLast === "number" && deleteLast > 0;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const lastMessage = messages.at(-1);
  const query =
    lastMessage?.parts.filter(isTextUIPart).map((p) => p.text).join("") ?? "";

  if (!query.trim()) {
    return Response.json({ error: "No query provided" }, { status: 400 });
  }

  const userId = session.user.id;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // On edit, remove the old tail (edited message + everything after) before
      // saving the new turn, so the conversation stays consistent.
      if (isEdit && chatId) {
        await deleteLastMessages(chatId, userId, deleteLast!);
      }

      // Retrieval and DB setup (chat record + user message) run in parallel.
      // Any failure here is caught by onError below and surfaced to the user as
      // an in-chat message instead of a hard 500.
      const [retrieval, resolvedChatId] = await Promise.all([
        ANSWER_MODE === "extractive"
          ? retrieveExtractiveAnswer(query, userId, { fileIds })
          : retrieveContext(query, userId, { fileIds }),
        ensureChatAndSaveUserMessage(userId, query, chatId, isEdit),
      ]);

      const sources = retrieval.sources;
      writer.write({ type: "data-sources", data: sources });

      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      let full = "";

      if ("answer" in retrieval) {
        // Extractive mode: stream the precomputed verbatim answer (no LLM).
        full = retrieval.answer;
        writer.write({ type: "text-delta", id, delta: full });
      } else {
        // Generative mode: an LLM writes the answer, with provider failover.
        // Text chunks are written manually (rather than merging the SDK stream)
        // so failover can trigger on the first token if the primary is down.
        const coreMessages = messages
          .slice(-MAX_HISTORY_MESSAGES)
          .flatMap((msg) => {
            const text = msg.parts.filter(isTextUIPart).map((p) => p.text).join("");
            if (!text) return [];
            return [{ role: msg.role as "user" | "assistant", content: text }];
          }) as ModelMessage[];

        const { textStream } = await streamTextWithFallback({
          system: buildSystemPrompt(retrieval.context),
          messages: coreMessages,
          // Cancels the underlying LLM call when the client presses stop, so the
          // provider stops generating (and billing) instead of running to the end.
          abortSignal: req.signal,
        });
        try {
          for await (const delta of textStream) {
            full += delta;
            writer.write({ type: "text-delta", id, delta });
          }
        } catch (err) {
          // A client stop aborts generation — keep whatever was produced. Any
          // other error is real and re-thrown to onError.
          const aborted =
            req.signal.aborted ||
            (err instanceof Error && err.name === "AbortError");
          if (!aborted) throw err;
        }
      }

      if (!req.signal.aborted) {
        writer.write({ type: "text-end", id });
      }

      // Persist the produced answer — including a partial one kept after a stop.
      // Skip empty content so stopping before the first token leaves no blank
      // assistant message.
      if (full.trim().length > 0) {
        await db.insert(chatMessages).values({
          chatId: resolvedChatId,
          role: "assistant",
          content: full,
          sources: sources.length > 0 ? JSON.stringify(sources) : null,
        });
      }
    },
    onError: (error) => {
      console.error("[/api/chat] stream error:", error);
      return "Sorry — I couldn't generate a response. The AI service may be temporarily unavailable. Please try again in a moment.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
