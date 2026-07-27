import { and, eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { files, chats, chatMessages } from "@/db/schema";
import { FileViewLayout } from "@/components/files";
import type { UIMessage } from "ai";
import type { Source } from "@/types/chat.types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FilePage({ params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))
    .limit(1);

  if (!file) notFound();

  // Load saved chat history for this file (file ID is the chat ID)
  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      sources: chatMessages.sources,
      editedAt: chatMessages.editedAt,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(chats, eq(chatMessages.chatId, chats.id))
    .where(and(eq(chats.id, id), eq(chats.userId, session.user.id)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(21);

  const hasMore = rows.length > 20;
  const savedMessages = rows.slice(0, 20).reverse();
  const initialCursor = savedMessages[0]?.createdAt?.toISOString() ?? null;

  const initialMessages: UIMessage[] = savedMessages.map((msg) => {
    const parts: UIMessage["parts"] = [];
    if (msg.role === "assistant" && msg.sources) {
      try {
        const sources = JSON.parse(msg.sources) as Source[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts.push({ type: "data-sources", data: sources } as any);
      } catch {}
    }
    parts.push({ type: "text", text: msg.content });
    return {
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts,
      ...(msg.editedAt
        ? { metadata: { editedAt: msg.editedAt.toISOString() } }
        : {}),
    };
  });

  return (
    <div className="h-full">
      <FileViewLayout
        file={file}
        initialMessages={initialMessages}
        hasMore={hasMore}
        initialCursor={initialCursor}
      />
    </div>
  );
}
