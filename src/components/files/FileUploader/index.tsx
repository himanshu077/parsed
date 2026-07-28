"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn, generateId } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FolderMoveModal } from "@/components/folders/FolderMoveModal";
import { TagInput } from "@/components/files/TagInput";
import { useFolders, buildFolderTree } from "@/hooks";

const ACCEPTED = ".pdf,.docx,.txt,.md";
const ACCEPTED_EXTS = new Set([".pdf", ".docx", ".txt", ".md"]);
const MAX_SIZE = 50 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Uploads via XHR (not fetch) so we get real upload-progress events.
 * Resolves with the parsed JSON response; rejects with a friendly Error.
 */
function xhrUpload(
  url: string,
  formData: FormData,
  onProgress: (loaded: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else if (xhr.status === 413) {
        reject(new Error("File too large for the server to accept"));
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          msg = JSON.parse(xhr.responseText).error ?? msg;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

interface QueuedFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface FileUploaderProps {
  /** Pre-select a folder (e.g. when uploading from inside a folder view) */
  defaultFolderId?: string;
  /** Render a shorter, single-row drop zone (e.g. on the dashboard) */
  compact?: boolean;
}

export function FileUploader({ defaultFolderId, compact }: FileUploaderProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId ?? null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: flatFolders = [] } = useFolders();

  const folderName = (() => {
    if (!folderId) return null;
    return flatFolders.find((f) => f.id === folderId)?.name ?? null;
  })();

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid: QueuedFile[] = [];
    for (const file of Array.from(incoming)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTS.has(ext)) {
        toast.error(`${file.name}: unsupported type. Use PDF, DOCX, TXT, or MD`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds 50 MB limit`);
        continue;
      }
      valid.push({ file, id: generateId(), status: "pending" });
    }
    if (valid.length) {
      setQueue((q) => [...q, ...valid]);
      setDialogOpen(true);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeFromQueue = (id: string) => {
    setQueue((q) => q.filter((f) => f.id !== id));
  };

  const uploadAll = async () => {
    if (queue.length === 0 || isUploading) return;
    setIsUploading(true);
    setProgress(0);

    const pending = queue.filter((f) => f.status === "pending");
    let succeeded = 0;
    let failed = 0;

    // Overall progress is tracked by bytes across all pending files, so a single
    // large file shows smooth 0→100% instead of jumping only when it completes.
    const totalBytes = pending.reduce((sum, f) => sum + f.file.size, 0) || 1;
    let uploadedBytes = 0;

    for (const item of pending) {
      setQueue((q) =>
        q.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)),
      );

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        if (folderId) formData.append("folderId", folderId);
        formData.append("tags", JSON.stringify(tags));

        await xhrUpload("/api/files", formData, (loaded) => {
          setProgress(
            Math.round(((uploadedBytes + loaded) / totalBytes) * 100),
          );
        });

        uploadedBytes += item.file.size;
        setProgress(Math.round((uploadedBytes / totalBytes) * 100));
        setQueue((q) =>
          q.map((f) => (f.id === item.id ? { ...f, status: "done" } : f)),
        );
        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        uploadedBytes += item.file.size;
        setQueue((q) =>
          q.map((f) => (f.id === item.id ? { ...f, status: "error", error: msg } : f)),
        );
        toast.error(`${item.file.name}: ${msg}`);
        failed++;
      }
    }

    setIsUploading(false);
    await qc.invalidateQueries({ queryKey: ["files"] });

    if (succeeded > 0) {
      toast.success(`${succeeded} file${succeeded > 1 ? "s" : ""} uploaded`);
    }

    // Close only if every file succeeded — use local counters, not stale queue state
    if (failed === 0) {
      setDialogOpen(false);
      setQueue([]);
      setTags([]);
      setProgress(0);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setDialogOpen(false);
    setQueue([]);
    setTags([]);
    setProgress(0);
  };

  return (
    <>
      {/* Drop zone / trigger button */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed transition-colors hover:border-primary hover:bg-accent/40",
          compact
            ? "flex items-center gap-4 p-4"
            : "flex flex-col items-center justify-center gap-3 p-10 text-center",
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg text-muted-foreground",
            compact ? "size-10 bg-muted" : "",
          )}
        >
          <Upload className={compact ? "size-5" : "size-8"} />
        </div>
        <div className={cn("min-w-0", compact ? "flex-1 text-left" : "")}>
          <p className="font-medium">
            {compact ? "Drop files or click to upload" : "Drop files here or click to upload"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            PDF, DOCX, TXT, MD — up to 50 MB each
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose files
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        onClick={(e) => ((e.target as HTMLInputElement).value = "")}
      />

      {/* Upload dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload files</DialogTitle>
          </DialogHeader>

          {/* File queue */}
          <div className="max-h-52 overflow-y-auto space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                </div>
                {item.status === "done" && (
                  <Badge variant="default" className="text-xs shrink-0">Done</Badge>
                )}
                {item.status === "error" && (
                  <Badge variant="destructive" className="text-xs shrink-0">Error</Badge>
                )}
                {item.status === "uploading" && (
                  <Badge variant="secondary" className="text-xs shrink-0">Uploading…</Badge>
                )}
                {item.status === "pending" && !isUploading && (
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.id)}
                    className="shrink-0 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Options */}
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Folder</Label>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {folderName ?? "No folder (root)"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFolderPickerOpen(true)}
                >
                  Change
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Tags</Label>
              <TagInput tags={tags} onChange={setTags} placeholder="Add tags…" />
            </div>

            {isUploading && (
              <div className="grid gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={uploadAll}
              disabled={isUploading || queue.filter((f) => f.status === "pending").length === 0}
            >
              {isUploading ? "Uploading…" : `Upload ${queue.filter((f) => f.status === "pending").length} file${queue.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder picker */}
      <FolderMoveModal
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onSelect={(id) => setFolderId(id)}
        title="Choose folder"
      />
    </>
  );
}
