"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Check, Copy, ExternalLink, Globe, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PDFViewer = dynamic(() => import("@/components/files/PDFViewer").then((m) => m.PDFViewer), { ssr: false });
const DocxViewer = dynamic(() => import("@/components/files/DocxViewer").then((m) => m.DocxViewer), { ssr: false });
const TxtViewer = dynamic(() => import("@/components/files/TxtViewer").then((m) => m.TxtViewer), { ssr: false });

interface Props {
  blobUrl: string;
  fileType: string;
  fileName: string;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 cursor-pointer rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-gray-700 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Splits a web-import doc's YAML frontmatter from its markdown body. */
function parseWebMeta(content: string): {
  meta: Record<string, string> | null;
  body: string;
} {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: null, body: content };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (key) meta[key] = val;
  }
  return { meta, body: content.slice(m[0].length) };
}

/** Renders a stored timestamp as readable text (handles both ISO and pre-formatted). */
function formatCrawledAt(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

function WebMetaHeader({ meta }: { meta: Record<string, string> }) {
  const crawled = formatCrawledAt(meta.crawled_at);
  let domain = meta.domain;
  if (!domain && meta.url) {
    try {
      domain = new URL(meta.url).hostname;
    } catch {}
  }
  if (!domain && !meta.url) return null;

  const pages = meta.total_pages;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border bg-card/50">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          {domain && <p className="truncate font-semibold">{domain}</p>}
          {meta.url && (
            <a
              href={meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <span className="truncate">{meta.url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {(crawled || pages) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          {crawled && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Crawled {crawled}
            </span>
          )}
          {pages && (
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              {pages} {pages === "1" ? "page" : "pages"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function FileViewer({ blobUrl, fileType }: Props) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fileType === "md" || fileType === "web") {
      setLoading(true);
      fetch(blobUrl)
        .then((r) => r.text())
        .then((text) => setTextContent(text))
        .finally(() => setLoading(false));
    }
  }, [blobUrl, fileType]);

  if (fileType === "pdf") return <PDFViewer url={blobUrl} />;
  if (fileType === "docx") return <DocxViewer url={blobUrl} />;
  if (fileType === "txt") return <TxtViewer url={blobUrl} />;

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if ((fileType === "md" || fileType === "web") && textContent) {
    const { meta, body } =
      fileType === "web"
        ? parseWebMeta(textContent)
        : { meta: null, body: textContent };
    return (
      <div className="h-full overflow-y-auto px-8 py-5">
        {meta && <WebMetaHeader meta={meta} />}
        <div
          className="prose prose-sm dark:prose-invert max-w-none
          prose-p:my-1.5 prose-headings:mb-2 prose-headings:mt-5 prose-h1:mt-0
          prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-hr:my-4
          prose-pre:!bg-gray-100 dark:prose-pre:!bg-gray-800 prose-pre:my-3
          prose-pre:!text-gray-800 dark:prose-pre:!text-gray-100
          prose-code:before:content-none prose-code:after:content-none"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ({ children }) => (
                <pre className="group relative">{children}</pre>
              ),
              code: ({ children, className }) => {
                const isBlock = !!className;
                const raw = String(children).replace(/\n$/, "");
                if (isBlock) {
                  return (
                    <>
                      <CopyButton code={raw} />
                      <code className={className}>{children}</code>
                    </>
                  );
                }
                return <code>{children}</code>;
              },
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return null;
}
