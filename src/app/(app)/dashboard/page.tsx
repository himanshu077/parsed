"use client";

import { useState } from "react";
import {
  FolderPlus,
  Upload,
  FileText,
  FolderOpen,
  HardDrive,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { FolderCard } from "@/components/folders";
import { FileList, FileUploader } from "@/components/files";
import { AiKeyBanner } from "@/components/settings";
import { useFolders, useFiles, buildFolderTree, useCreateFolder } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/40 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const create = useCreateFolder();

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim() });
      toast.success("Folder created");
      setName("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="folder-name">Name</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Research Papers"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const { data: flatFolders = [], isLoading: foldersLoading } = useFolders();
  const { data: allFiles = [], isLoading: filesLoading } = useFiles();
  const rootFolders = buildFolderTree(flatFolders).filter((f) => !f.parentId);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  const isLoading = foldersLoading || filesLoading;
  const isNewUser = !isLoading && allFiles.length === 0 && flatFolders.length === 0;
  const totalSize = allFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

  if (isNewUser) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-full max-w-lg">
          <AiKeyBanner />
        </div>
        <div className="rounded-full bg-muted p-5">
          <Upload className="size-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Upload your first file</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Then ask it anything. Parsed will extract, index, and make it ready to chat with.
          </p>
        </div>
        <div className="w-full max-w-lg">
          <FileUploader />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <AiKeyBanner />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload documents and ask them anything.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setFolderDialogOpen(true)}
        >
          <FolderPlus className="size-4" />
          New folder
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={FolderOpen} label="Folders" value={flatFolders.length} />
        <StatTile icon={FileText} label="Files" value={allFiles.length} />
        <StatTile icon={HardDrive} label="Storage" value={formatBytes(totalSize)} />
      </div>

      {/* Folders */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Folders{" "}
          <span className="font-normal text-muted-foreground">
            · {rootFolders.length}
          </span>
        </h2>
        {foldersLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : rootFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No folders yet.{" "}
            <button
              onClick={() => setFolderDialogOpen(true)}
              className="cursor-pointer underline underline-offset-2 hover:text-foreground"
            >
              Create one
            </button>{" "}
            to organise your files.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rootFolders.map((folder) => (
              <FolderCard key={folder.id} folder={folder} />
            ))}
          </div>
        )}
      </section>

      {/* Upload */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Upload</h2>
        <FileUploader compact />
      </section>

      {/* Root files */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Files{" "}
          <span className="font-normal text-muted-foreground">
            · {allFiles.length}
          </span>
        </h2>
        <FileList />
      </section>

      <NewFolderDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} />
    </div>
  );
}
