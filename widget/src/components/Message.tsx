import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import { cn } from "@/lib/utils";
import type { Message as MessageType } from "@/types";

interface Props {
  message: MessageType;
  primaryColor: string;
}

function fixMarkdown(content: string): string {
  let fixed = content.replace(/^[ \t]+(```)/gm, "$1");
  const fences = fixed.match(/^```/gm) ?? [];
  if (fences.length % 2 !== 0) fixed += "\n```";
  return fixed;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked on insecure origins — ignore
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function Message({ message, primaryColor }: Props) {
  const isUser = message.role === "user";
  const showCopy = !isUser && !message.isStreaming && !!message.content;

  return (
    <div className={cn("group flex w-full min-w-0 flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] min-w-0 overflow-hidden break-words rounded-2xl text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm px-3.5 py-2.5 text-white"
            : "rounded-bl-sm bg-white px-4 py-3 text-zinc-800 shadow-sm shadow-black/5 ring-1 ring-black/[0.04]",
        )}
        style={isUser ? { backgroundColor: primaryColor } : undefined}
      >
        {message.isStreaming && !message.content ? (
          <TypingIndicator />
        ) : isUser ? (
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            children={fixMarkdown(message.content)}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              pre: ({ children }) => (
                <pre className="rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs my-2 overflow-x-auto whitespace-pre">
                  {children}
                </pre>
              ),
              code: ({ children, className }) => (
                <code className={cn("font-mono text-xs", !className && "rounded bg-zinc-100 px-1 py-0.5")}>
                  {children}
                </code>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
              h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
              h4: ({ children }) => <h4 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h4>,
              h5: ({ children }) => <h5 className="text-xs font-semibold mb-1 mt-2 first:mt-0">{children}</h5>,
              h6: ({ children }) => <h6 className="text-xs font-medium mb-1 mt-2 first:mt-0">{children}</h6>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80 [overflow-wrap:anywhere]">
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-zinc-400/40 pl-3 my-2 text-zinc-500 italic">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-3 border-zinc-400/20" />,
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-zinc-400/20">{children}</tr>,
              th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold bg-white/40">{children}</th>,
              td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
            }}
          />
        )}
      </div>
      {showCopy && (
        <div className="pl-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={message.content} />
        </div>
      )}
    </div>
  );
}
