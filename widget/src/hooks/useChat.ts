import { useState, useCallback, useRef } from "react";
import { streamChat } from "@/lib/api";
import type { Message, WidgetConfig } from "@/types";

// crypto.randomUUID exists only in secure contexts (HTTPS/localhost).
// Widgets embedded on plain http:// sites would otherwise throw here.
function uid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useChat(config: WidgetConfig) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const assistantIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return;

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text.trim(),
      };
      const assistantId = uid();
      assistantIdRef.current = assistantId;

      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      // Build history from messages before this exchange
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      await streamChat(config, text.trim(), history, {
        onChunk(chunk) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          );
        },
        onSources(sources) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)),
          );
        },
        onDone() {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
          setIsStreaming(false);
        },
        onError(message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: message, isStreaming: false } : m,
            ),
          );
          setIsStreaming(false);
        },
      });
    },
    [config, isStreaming, messages],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, clearMessages };
}
