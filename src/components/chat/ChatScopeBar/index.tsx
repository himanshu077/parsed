"use client";

import { X, Files, Folder, Tag, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileWithFolder } from "@/types/file.types";
import type { Folder as FolderType } from "@/db/schema";

interface Props {
  selectedFiles: FileWithFolder[];
  selectedFolder: FolderType | null;
  selectedTags: string[];
  availableTags: string[];
  onRemoveFile: (fileId: string) => void;
  onClearScope: () => void;
  onToggleTag: (tag: string) => void;
}

export function ChatScopeBar({
  selectedFiles,
  selectedFolder,
  selectedTags,
  availableTags,
  onRemoveFile,
  onClearScope,
  onToggleTag,
}: Props) {
  const hasScope =
    selectedFiles.length > 0 || selectedFolder !== null || selectedTags.length > 0;

  return (
    <div className="border-b">
      <div className="mx-auto flex min-h-11 w-full max-w-3xl flex-wrap items-center gap-2 px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          Scope
        </span>

        {!hasScope ? (
          <Badge variant="secondary" className="gap-1 font-normal">
            <Files className="size-3" />
            All files
          </Badge>
        ) : (
          <>
            {selectedFolder && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Folder className="size-3" />
                {selectedFolder.name}
                <button onClick={onClearScope} className="ml-0.5 hover:text-foreground">
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {selectedFiles.map((file) => (
              <Badge key={file.id} variant="secondary" className="gap-1 text-xs">
                <Files className="size-3" />
                {file.name}
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}

            {selectedTags.map((tag) => (
              <Badge key={tag} variant="default" className="gap-1 text-xs">
                <Tag className="size-3" />
                {tag}
                <button onClick={() => onToggleTag(tag)} className="ml-0.5 hover:opacity-80">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </>
        )}

        {availableTags.filter((t) => !selectedTags.includes(t)).length > 0 && (
          <>
            <span className="text-muted-foreground/40">·</span>
            {availableTags
              .filter((t) => !selectedTags.includes(t))
              .map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer gap-1 text-xs text-muted-foreground opacity-70 hover:opacity-100"
                  onClick={() => onToggleTag(tag)}
                >
                  <Tag className="size-3" />
                  {tag}
                </Badge>
              ))}
          </>
        )}

        {hasScope && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            onClick={onClearScope}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
