import { eq } from "drizzle-orm";
import { pusher } from "./pusher";
import { db } from "./database";
import { files, folders, fileChunks } from "@/db/schema";
import { parseFile } from "./parsers";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddings";
import { upsertChunks, deleteChunksByIds } from "./pinecone";
import type { ChunkMetadata } from "./pinecone";

export type FileProgressData = {
  step: string;
  message: string;
  progress: number;
  done?: boolean;
  error?: string; // set when step === "error"
};

const emit = (fileId: string, data: FileProgressData) =>
  pusher.trigger(`file-${fileId}`, "progress", data);

/**
 * Runs the full file-processing pipeline: download → parse → chunk → embed →
 * upsert to Pinecone → persist chunks → mark ready. Emits Pusher progress at
 * each stage. Throws on failure (caller decides retry / error-state handling).
 *
 * Shared by the Inngest background function (production) and the local inline
 * path (`after()`), so both run identical logic.
 */
export async function runFileProcessing(
  fileId: string,
  userId: string,
): Promise<{ fileId: string; chunks: number }> {
  const t0 = Date.now();
  const log = (msg: string) =>
    console.log(`[file-processing] ${fileId} +${Date.now() - t0}ms ${msg}`);
  log("START");

  // ── Mark processing ─────────────────────────────────────────────────────────
  await db
    .update(files)
    .set({ status: "processing", errorMessage: null })
    .where(eq(files.id, fileId));

  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) throw new Error("File not found");
  log(`loaded file type=${file.type} size=${file.size}`);

  await emit(fileId, { step: "download", message: "Downloading file…", progress: 10 });

  // ── Download from Vercel Blob ───────────────────────────────────────────────
  const res = await fetch(file.blobUrl);
  if (!res.ok) throw new Error("Failed to download file from storage");
  const buffer = await res.arrayBuffer();
  log(`downloaded ${buffer.byteLength} bytes`);

  await emit(fileId, { step: "parse", message: "Extracting text…", progress: 25 });

  // ── Parse text ──────────────────────────────────────────────────────────────
  const text = await parseFile(buffer, file.type);
  if (!text.trim()) throw new Error("No text could be extracted from file");
  log(`parsed text chars=${text.length}`);

  await emit(fileId, { step: "chunk", message: "Chunking text…", progress: 40 });

  // ── Chunk text ──────────────────────────────────────────────────────────────
  const chunks = await chunkText(text, file.type);
  if (chunks.length === 0) throw new Error("No chunks produced from file");
  log(`chunked count=${chunks.length}`);

  await emit(fileId, { step: "resolve", message: "Resolving folder path…", progress: 50 });

  // ── Resolve folder path ─────────────────────────────────────────────────────
  let folderPath = "";
  if (file.folderId) {
    const allFolders = await db.select().from(folders).where(eq(folders.userId, userId));
    const parts: string[] = [];
    let current = allFolders.find((f) => f.id === file.folderId);
    while (current) {
      parts.unshift(current.name);
      current = current.parentId
        ? allFolders.find((f) => f.id === current!.parentId)
        : undefined;
    }
    folderPath = parts.join(" / ");
  }

  await emit(fileId, { step: "cleanup", message: "Cleaning up old data…", progress: 55 });

  // ── Delete existing chunks (idempotent re-processing) ───────────────────────
  const existing = await db
    .select({ pineconeId: fileChunks.pineconeId })
    .from(fileChunks)
    .where(eq(fileChunks.fileId, fileId));
  if (existing.length > 0) {
    await deleteChunksByIds(userId, existing.map((c) => c.pineconeId));
    await db.delete(fileChunks).where(eq(fileChunks.fileId, fileId));
  }

  await emit(fileId, { step: "embed", message: `Embedding ${chunks.length} chunks…`, progress: 65 });

  // ── Embed all chunks ────────────────────────────────────────────────────────
  log(`embedding ${chunks.length} chunks…`);
  const embeddings = await embedTexts(chunks);
  log(`embedded ${embeddings.length} vectors dim=${embeddings[0]?.length}`);

  await emit(fileId, { step: "upsert", message: "Storing in vector DB…", progress: 85 });

  // ── Upsert to Pinecone ──────────────────────────────────────────────────────
  const vectors = chunks.map((chunk, i) => ({
    id: `${fileId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      fileId,
      fileName: file.name,
      fileType: file.type,
      folderId: file.folderId ?? "",
      folderPath,
      chunkIndex: i,
      tags: file.tags,
      size: file.size,
      preview: chunk.slice(0, 200),
      content: chunk,
    } satisfies ChunkMetadata,
  }));
  await upsertChunks(userId, vectors);
  log(`upserted ${vectors.length} vectors to Pinecone`);

  await emit(fileId, { step: "save", message: "Saving to database…", progress: 95 });

  // ── Persist chunks + mark ready ─────────────────────────────────────────────
  const dbRows = chunks.map((chunk, i) => ({
    fileId,
    content: chunk,
    chunkIndex: i,
    pineconeId: `${fileId}-chunk-${i}`,
  }));
  await db.insert(fileChunks).values(dbRows);
  await db.update(files).set({ status: "ready" }).where(eq(files.id, fileId));
  log(`DONE status=ready chunks=${chunks.length}`);

  await emit(fileId, { step: "done", message: "Ready!", progress: 100, done: true });

  return { fileId, chunks: chunks.length };
}

/**
 * Marks a file as errored and notifies the client. Used by the Inngest
 * onFailure handler and the inline path's catch.
 */
export async function markProcessingError(fileId: string, message: string): Promise<void> {
  await db
    .update(files)
    .set({ status: "error", errorMessage: message })
    .where(eq(files.id, fileId));
  await emit(fileId, { step: "error", message: "Processing failed", progress: 0, error: message });
}

/**
 * When true, uploads are processed inline via `after()` instead of being sent
 * to Inngest — used for local dev on machines where the Inngest dev-server
 * binary can't run (e.g. blocked by Windows Smart App Control).
 */
export const INNGEST_DISABLED = process.env.INNGEST_DISABLED === "1";
