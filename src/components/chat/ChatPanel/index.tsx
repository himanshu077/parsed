"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Virtuoso } from "react-virtuoso";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, isDataUIPart } from "ai";
import type { UIMessage } from "ai";
import { generateId } from "@/lib/utils";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { SourceCard } from "@/components/chat/SourceCard";
import type { Source } from "@/types/chat.types";

const THINKING_PHRASES = [
  "Reading your documents...",
  "Searching for context...",
  "Thinking it through...",
  "Pulling the relevant bits...",
  "Almost got it...",
];

function ThinkingTypewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = useCallback(() => {
    const phrase = THINKING_PHRASES[phraseIndex];
    if (typing) {
      if (displayed.length < phrase.length) {
        timeoutRef.current = setTimeout(
          () => setDisplayed(phrase.slice(0, displayed.length + 1)),
          38,
        );
      } else {
        timeoutRef.current = setTimeout(() => setTyping(false), 1000);
      }
    } else {
      if (displayed.length > 0) {
        timeoutRef.current = setTimeout(
          () => setDisplayed((p) => p.slice(0, -1)),
          18,
        );
      } else {
        setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
        setTyping(true);
      }
    }
  }, [displayed, typing, phraseIndex]);

  useEffect(() => {
    tick();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tick]);

  return (
    <div className="flex justify-start px-1 py-1">
      <span className="text-sm text-muted-foreground">{displayed}</span>
      <span className="ml-0.5 inline-block w-px h-[1em] bg-muted-foreground/60 animate-pulse align-text-bottom" />
    </div>
  );
}

type DBRow = {
  id: string;
  role: string;
  content: string;
  sources: string | null;
  editedAt: string | null;
  createdAt: string;
};

function rowsToUIMessages(rows: DBRow[]): UIMessage[] {
  return rows.map((row) => {
    const parts: UIMessage["parts"] = [];
    if (row.role === "assistant" && row.sources) {
      try {
        const sources = JSON.parse(row.sources) as Source[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts.push({ type: "data-sources", data: sources } as any);
      } catch {}
    }
    parts.push({ type: "text", text: row.content });
    return {
      id: row.id,
      role: row.role as "user" | "assistant",
      parts,
      ...(row.editedAt ? { metadata: { editedAt: row.editedAt } } : {}),
    };
  });
}

const START_INDEX = 100000;
const PAGE_SIZE = 20;

interface Props {
  fileIds?: string[];
  placeholder?: string;
  chatId?: string;
  initialMessages?: UIMessage[];
  hideSources?: boolean;
  initialHasMore?: boolean;
  initialCursor?: string | null;
}

export function ChatPanel({
  fileIds,
  placeholder,
  chatId: chatIdProp,
  initialMessages,
  hideSources,
  initialHasMore,
  initialCursor,
}: Props) {
  const [input, setInput] = useState("");
  const [chatId] = useState(() => chatIdProp ?? generateId());

  const fileIdsRef = useRef(fileIds);
  fileIdsRef.current = fileIds;

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  // Set for one request when editing — tells the server to drop the last N
  // messages before saving the edited turn. Read-and-cleared per request.
  const editDeleteRef = useRef<number | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const del = editDeleteRef.current;
          editDeleteRef.current = null;
          return {
            chatId: chatIdRef.current,
            ...(fileIdsRef.current ? { fileIds: fileIdsRef.current } : {}),
            ...(del != null ? { deleteLast: del } : {}),
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport,
    messages: initialMessages ?? [],
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  // Tracks which user messages were edited (id → editedAt ISO) so the "Edited"
  // badge shows immediately in-session; on reload it comes from message metadata.
  const [editedIds, setEditedIds] = useState<Record<string, string>>({});
  const pendingEditRef = useRef<string | null>(null);

  // When an edit is sent, record its editedAt against the newly-added user
  // message (the last one) as soon as it appears in the list.
  useEffect(() => {
    if (!pendingEditRef.current) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const at = pendingEditRef.current;
      pendingEditRef.current = null;
      setEditedIds((prev) => ({ ...prev, [lastUser.id]: at }));
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Pagination
  const [olderMessages, setOlderMessages] = useState<UIMessage[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [cursor, setCursor] = useState<string | null>(initialCursor ?? null);
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const allMessages = [...olderMessages, ...messages];

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages?before=${encodeURIComponent(cursor)}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) return;
      const { messages: rows, hasMore: more } = (await res.json()) as {
        messages: DBRow[];
        hasMore: boolean;
      };
      if (rows.length > 0) {
        setOlderMessages((prev) => [...rowsToUIMessages(rows), ...prev]);
        setFirstItemIndex((prev) => prev - rows.length);
        setCursor(rows[0].createdAt);
      }
      setHasMore(more);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, cursor, chatId]);

  function handleSubmit() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    setStopped(false);
    sendMessage({ text });
  }

  // Edit a prior user message: drop it and everything after it, then re-send the
  // edited text so the answer regenerates. Truncation happens server-side in the
  // same request (deleteLast), so the client updates + resends synchronously —
  // no blank flash — and the tail (always the newest N) truncates the DB exactly.
  const handleEditSubmit = useCallback(
    (messageId: string, newText: string) => {
      const text = newText.trim();
      if (!text || isLoading) return;

      const combined = [...olderMessages, ...messages];
      const i = combined.findIndex((m) => m.id === messageId);
      if (i === -1) return;

      setEditingId(null);
      setStopped(false);
      setOlderMessages((prev) => prev.slice(0, Math.min(i, prev.length)));
      setMessages(messages.slice(0, Math.max(0, i - olderMessages.length)));

      editDeleteRef.current = combined.length - i;
      pendingEditRef.current = new Date().toISOString();
      sendMessage({ text });
    },
    [isLoading, olderMessages, messages, setMessages, sendMessage],
  );

  function getMessageText(parts: UIMessage["parts"]): string {
    return parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join("");
  }

  function handleStop() {
    // If we stop before any assistant text is produced, flag it so the UI can
    // show a "you stopped this response" note (there's no partial answer to keep).
    const last = messages[messages.length - 1];
    const lastText = last ? getMessageText(last.parts) : "";
    if (status === "submitted" || (last?.role === "assistant" && !lastText)) {
      setStopped(true);
    }
    stop();
  }

  function getMessageSources(parts: UIMessage["parts"]): Source[] {
    return parts
      .filter(isDataUIPart)
      .filter((p) => p.type === "data-sources")
      .flatMap((p) => p.data as Source[]);
  }

  const showPlaceholder = allMessages.length === 0 && status !== "submitted";
  const showThinking =
    status === "submitted" ||
    (status === "streaming" &&
      messages.length > 0 &&
      !getMessageText(messages[messages.length - 1].parts));

  const THINKING_ID = "__thinking__";
  const listItems = showThinking
    ? [
        ...allMessages,
        {
          id: THINKING_ID,
          role: "thinking" as const,
          parts: [],
        } as unknown as UIMessage,
      ]
    : allMessages;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        {showPlaceholder ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">
              {placeholder ?? "Ask anything about your document"}
            </p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: "100%" }}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={listItems.length - 1}
            data={listItems}
            startReached={loadOlderMessages}
            followOutput="smooth"
            components={{
              Header: () =>
                loadingMore ? (
                  <div className="flex justify-center py-3">
                    <span className="text-xs text-muted-foreground">
                      Loading older messages…
                    </span>
                  </div>
                ) : null,
            }}
            itemContent={(_, message) => {
              if (message.id === THINKING_ID) {
                return (
                  <div className="mx-auto w-full max-w-3xl px-4 py-2">
                    <ThinkingTypewriter />
                  </div>
                );
              }
              const text = getMessageText(message.parts);
              const sources =
                message.role === "assistant"
                  ? getMessageSources(message.parts)
                  : [];
              const isLastMessage =
                allMessages.length > 0 &&
                message.id === allMessages[allMessages.length - 1].id;
              const editedAt =
                message.role === "user"
                  ? editedIds[message.id] ??
                    (message.metadata as { editedAt?: string } | undefined)
                      ?.editedAt
                  : undefined;
              return (
                <div className="mx-auto w-full min-w-0 max-w-3xl space-y-1 overflow-hidden px-4 py-2">
                  <ChatMessage
                    role={message.role as "user" | "assistant"}
                    content={text}
                    hideActions={isLoading && isLastMessage}
                    editing={editingId === message.id}
                    editedAt={editedAt}
                    onStartEdit={
                      message.role === "user"
                        ? () => setEditingId(message.id)
                        : undefined
                    }
                    onCancelEdit={() => setEditingId(null)}
                    onSubmitEdit={(t) => handleEditSubmit(message.id, t)}
                  />
                  {!hideSources && sources.length > 0 && (
                    <>
                      <span className="text-[11px] ml-9 font-medium text-muted-foreground">
                        Sources
                      </span>
                      <div className="ml-9.5 flex flex-wrap items-center gap-1.5 pt-1.5">
                        {sources.map((source) => (
                          <Link
                            key={source.fileId}
                            href={source.pageUrl ?? `/files/${source.fileId}`}
                            target={source.pageUrl ? "_blank" : undefined}
                            rel={
                              source.pageUrl ? "noopener noreferrer" : undefined
                            }
                          >
                            <SourceCard source={source} />
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {status === "error" && error && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message || "Something went wrong. Please try again."}
          </div>
        </div>
      )}

      {stopped && !isLoading && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4">
          <p className="text-center text-xs text-muted-foreground">
            You stopped this response.
          </p>
        </div>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={handleStop}
        isLoading={isLoading}
        placeholder={placeholder}
      />
    </div>
  );
}
