"use client";

import Link from "next/link";
import { MoveLeft } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { FileViewer } from "@/components/files/FileViewer";
import { ChatPanel } from "@/components/chat";
import type { UIMessage } from "ai";

interface Props {
  file: {
    id: string;
    name: string;
    type: string;
    status: string;
    blobUrl: string;
    folderId: string | null;
  };
  initialMessages: UIMessage[];
  hasMore: boolean;
  initialCursor: string | null;
}

export function FileViewLayout({
  file,
  initialMessages,
  hasMore,
  initialCursor,
}: Props) {
  return (
    <Group orientation="horizontal" className="h-full">
      {/* File viewer */}
      <Panel defaultSize="65%" minSize="30%" className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Link
            href={file.folderId ? `/folders/${file.folderId}` : "/"}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoveLeft className="mr-2 size-4" />
          </Link>
          <h1 className="truncate text-sm font-medium">{file.name}</h1>
          {file.status !== "ready" && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {file.status}
            </span>
          )}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <FileViewer
            blobUrl={file.blobUrl}
            fileType={file.type}
            fileName={file.name}
          />
        </div>
      </Panel>

      {/* Drag handle */}
      <Separator className="relative w-px bg-border transition-colors hover:bg-primary/60">
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </Separator>

      {/* Chat panel */}
      <Panel defaultSize="35%" minSize="20%" className="flex flex-col overflow-hidden">
        <div className="border-b px-4 py-2">
          <p className="text-sm font-medium">Chat</p>
        </div>
        {file.status === "ready" ? (
          <ChatPanel
            chatId={file.id}
            fileIds={[file.id]}
            initialMessages={initialMessages}
            initialHasMore={hasMore}
            initialCursor={initialCursor}
            placeholder={`Ask anything about ${file.name}…`}
            hideSources
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {file.status === "error"
                ? "This file failed to process and cannot be chatted with."
                : "This file is still being processed. Check back in a moment."}
            </p>
          </div>
        )}
      </Panel>
    </Group>
  );
}
