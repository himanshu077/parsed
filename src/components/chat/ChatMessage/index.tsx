"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Pencil } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  role: "user" | "assistant";
  content: string;
  /** Hide the copy/edit action row (e.g. while the assistant is responding). */
  hideActions?: boolean;
  /** Whether this (user) message is currently in inline-edit mode. */
  editing?: boolean;
  /** ISO timestamp — when set, shows an "Edited" badge on a user message. */
  editedAt?: string;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (text: string) => void;
}

function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Remark doesn't recognize indented ``` fences (common inside list items from AI output).
// Strip leading whitespace from fence markers so they're always document-level.
// Also close any unclosed fence (happens mid-stream).
function fixMarkdown(content: string): string {
  let fixed = content.replace(/^[ \t]+(```)/gm, "$1");
  const fences = fixed.match(/^```/gm) ?? [];
  if (fences.length % 2 !== 0) fixed += "\n```";
  return fixed;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

const avatarBase =
  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold select-none";

const actionBtn =
  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button onClick={copy} title="Copy" className={actionBtn}>
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      <span className="sr-only">Copy message</span>
    </button>
  );
}

export function ChatMessage({
  role,
  content,
  hideActions,
  editing,
  editedAt,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
}: Props) {
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState(content);

  // Reset the draft to the original text each time edit mode opens.
  useEffect(() => {
    if (editing) setDraft(content);
  }, [editing, content]);

  if (role === "assistant" && !content) return null;

  if (role === "user") {
    if (editing) {
      const submit = () => {
        if (draft.trim()) onSubmitEdit?.(draft);
      };
      return (
        <div className="flex w-full justify-end">
          <div className="flex w-full max-w-[85%] flex-col gap-2 rounded-2xl bg-muted p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") onCancelEdit?.();
              }}
              autoFocus
              rows={2}
              className="max-h-48 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={!draft.trim()}>
                Send
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex w-full justify-end gap-2.5">
        <div className="flex min-w-0 max-w-[80%] flex-col items-end">
          {editedAt && (
            <span
              title={`Edited ${formatEditedAt(editedAt)}`}
              className="mb-0.5 mr-1 cursor-default text-[11px] text-muted-foreground"
            >
              Edited
            </span>
          )}
          <div className="min-w-0 break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
          {!hideActions && (
            <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {onStartEdit && (
                <button onClick={onStartEdit} title="Edit" className={actionBtn}>
                  <Pencil className="size-3.5" />
                  <span className="sr-only">Edit message</span>
                </button>
              )}
              <CopyButton text={content} />
            </div>
          )}
        </div>
        <div className={cn(avatarBase, "mt-0.5 bg-muted text-foreground")}>
          {getInitials(session?.user?.name)}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full justify-start gap-2.5">
      <div className={cn(avatarBase, "mt-0.5 bg-primary text-primary-foreground")}>P</div>
      <div className="flex min-w-0 max-w-[80%] flex-col items-start">
        <div className="min-w-0 break-words rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            children={fixMarkdown(content)}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto whitespace-pre rounded-md bg-background/60 px-3 py-2 font-mono text-xs">
                  {children}
                </pre>
              ),
              code: ({ children, className }) => (
                <code className={cn("font-mono text-xs", !className && "rounded bg-background/60 px-1 py-0.5")}>
                  {children}
                </code>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
              h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-sm font-bold first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
              h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>,
              h5: ({ children }) => <h5 className="mb-1 mt-2 text-xs font-semibold first:mt-0">{children}</h5>,
              h6: ({ children }) => <h6 className="mb-1 mt-2 text-xs font-medium first:mt-0">{children}</h6>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:opacity-80">
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2 border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-3 border-muted-foreground/20" />,
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-muted-foreground/20">{children}</tr>,
              th: ({ children }) => <th className="bg-background/40 px-3 py-1.5 text-left font-semibold">{children}</th>,
              td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
            }}
          />
        </div>
        {!hideActions && (
          <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  );
}
