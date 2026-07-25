import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  isTextUIPart,
} from "ai";
import type { UIMessage, ModelMessage } from "ai";
import { auth } from "@/lib/auth";
import { retrieveContext, buildSystemPrompt } from "@/lib/rag";
import { getLLMModel, LLM_TEMPERATURE } from "@/lib/ai";
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
  await db.insert(chatMessages).values({ chatId: id!, role: "user", content: query });
  return id!;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { messages?: UIMessage[]; fileIds?: string[]; chatId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, fileIds, chatId } = body;
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
      // Retrieval (embed + Pinecone) and DB setup (chat record + user message)
      // run in parallel. Any failure here is caught by onError below and
      // surfaced to the user as an in-chat message instead of a hard 500.
      const [{ context, sources }, resolvedChatId] = await Promise.all([
        retrieveContext(query, userId, { fileIds }),
        ensureChatAndSaveUserMessage(userId, query, chatId),
      ]);

      writer.write({ type: "data-sources", data: sources });

      // Trim to last N messages to keep model input small
      const coreMessages = messages
        .slice(-MAX_HISTORY_MESSAGES)
        .flatMap((msg) => {
          const text = msg.parts.filter(isTextUIPart).map((p) => p.text).join("");
          if (!text) return [];
          return [{ role: msg.role as "user" | "assistant", content: text }];
        }) as ModelMessage[];

      const result = streamText({
        model: getLLMModel(),
        temperature: LLM_TEMPERATURE,
        system: buildSystemPrompt(context),
        messages: coreMessages,
        onFinish: async ({ text }) => {
          await db.insert(chatMessages).values({
            chatId: resolvedChatId,
            role: "assistant",
            content: text,
            sources: sources.length > 0 ? JSON.stringify(sources) : null,
          });
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("[/api/chat] stream error:", error);
      return "Sorry — I couldn't generate a response. The AI service may be temporarily unavailable. Please try again in a moment.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
