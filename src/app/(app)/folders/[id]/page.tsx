import { and, asc, count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { folders, files } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { FolderCard, NewSubfolderButton, DeleteFolderButton, EmbedButton } from "@/components/folders";
import { FileList, FileUploader } from "@/components/files";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FolderPage({ params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");

  const userId = session.user.id;

  const allFolders = await db
    .select()
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(asc(folders.name));

  const current = allFolders.find((f) => f.id === id);
  if (!current) notFound();

  const subfolders = allFolders.filter((f) => f.parentId === id);

  const [fileCountRow] = await db
    .select({ value: count() })
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.folderId, id)));
  const fileCount = fileCountRow?.value ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      {/* Heading + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {current.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subfolders.length} subfolder{subfolders.length !== 1 ? "s" : ""} ·{" "}
            {fileCount} file{fileCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href={`/chat?folderId=${id}`}>
              <MessageSquare className="size-4" />
              Ask about this folder
            </Link>
          </Button>
          <NewSubfolderButton parentId={id} />
          <EmbedButton folderId={id} folderName={current.name} />
          <DeleteFolderButton
            folderId={id}
            folderName={current.name}
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        </div>
      </div>

      {/* Upload */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Upload</h2>
        <FileUploader defaultFolderId={id} compact />
      </section>

      {/* Subfolders */}
      {subfolders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Folders{" "}
            <span className="font-normal text-muted-foreground">
              · {subfolders.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subfolders.map((sub) => (
              <FolderCard key={sub.id} folder={sub} />
            ))}
          </div>
        </section>
      )}

      {/* Files */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Files{" "}
          <span className="font-normal text-muted-foreground">· {fileCount}</span>
        </h2>
        <FileList folderId={id} />
      </section>
    </div>
  );
}
