"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Source } from "@/types/chat.types";

const TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-100 text-red-500",
  docx: "bg-blue-100 text-blue-500",
  md: "bg-purple-100 text-purple-500",
  txt: "bg-gray-100 text-gray-500",
  web: "bg-green-100 text-green-500",
};

interface Props {
  source: Source;
}

export function SourceCard({ source }: Props) {
  const colorClass = TYPE_COLORS[source.fileType] ?? "bg-muted text-muted-foreground";

  return (
    <div
      title={source.preview || source.fileName}
      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border bg-card px-2 py-1 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className={cn("flex size-4 shrink-0 items-center justify-center rounded", colorClass)}>
        <FileText className="size-2.5" />
      </div>
      <span className="truncate text-xs font-medium leading-none">{source.fileName}</span>
      <span className="shrink-0 text-[10px] uppercase leading-none text-muted-foreground">
        {source.fileType}
      </span>
    </div>
  );
}
