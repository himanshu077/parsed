import { eq } from "drizzle-orm";
import { pusher } from "@/lib/pusher";
import { db } from "@/lib/database";
import { files, fileChunks, folders, webCrawlJobs } from "@/db/schema";
import { crawlAndExtract } from "@/lib/crawler";
import { compileSiteMarkdown } from "@/lib/extractor";
import { uploadToBlob } from "@/lib/storage";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { getUserAiConfig } from "@/lib/user-ai-config";
import { upsertChunks } from "@/lib/pinecone";
import type { ChunkMetadata } from "@/lib/pinecone";

export type CrawlProgressData = {
  step: string;
  message: string;
  processedPages?: number;
  totalPages?: number;
  fileId?: string;
  folderId?: string;
  done?: boolean;
  error?: string;
};

const emit = (jobId: string, data: CrawlProgressData) =>
  pusher.trigger(`crawl-${jobId}`, "progress", data);

/**
 * Runs the full website crawl pipeline: crawl → compile markdown → store file →
 * chunk → embed → upsert to Pinecone → mark ready. Emits Pusher progress at each
 * stage. Throws on failure (caller decides error-state handling).
 *
 * Shared by the Inngest background function (production) and the local inline
 * path (`after()`), so both run identical logic.
 */
export async function runWebCrawl(
  jobId: string,
  userId: string,
  rootUrl: string,
  maxPages = 25,
): Promise<{ jobId: string; fileId: string; pages: number }> {
  await db.update(webCrawlJobs).set({ status: "crawling" }).where(eq(webCrawlJobs.id, jobId));
  await emit(jobId, { step: "discover", message: "Crawling pages…" });

  // ── Single-pass crawl — fetch each URL once, discover links + extract content ──
  const allPageData = await crawlAndExtract(rootUrl, maxPages, async (processed, estimated) => {
    await emit(jobId, {
      step: "extracting",
      message: `Crawled ${processed} of ~${estimated} pages…`,
      processedPages: processed,
      totalPages: estimated,
    });
  });

  const total = allPageData.length;

  await db
    .update(webCrawlJobs)
    .set({ status: "processing", totalPages: total })
    .where(eq(webCrawlJobs.id, jobId));

  await emit(jobId, {
    step: "store",
    message: `Found ${total} page${total === 1 ? "" : "s"} — saving…`,
    totalPages: total,
    processedPages: total,
  });

  // ── Compile full site markdown + upload to Blob + create DB records ──
  const domain = new URL(rootUrl).hostname;
  const safeDomain = domain.replace(/[^a-z0-9]/gi, "-");
  const markdown = compileSiteMarkdown(rootUrl, allPageData);

  const encoder = new TextEncoder();
  const buffer = encoder.encode(markdown).buffer as ArrayBuffer;
  const blobUrl = await uploadToBlob(`web/${safeDomain}.md`, buffer, "text/markdown");

  const [folder] = await db
    .insert(folders)
    .values({ userId, name: domain, parentId: null })
    .returning();

  const [row] = await db
    .insert(files)
    .values({
      userId,
      folderId: folder.id,
      name: `web-scraping-${safeDomain}`,
      originalName: `web-scraping-${safeDomain}.md`,
      type: "web",
      size: encoder.encode(markdown).length,
      blobUrl,
      status: "processing",
      tags: [],
    })
    .returning();

  const fileId = row.id;
  const folderId = folder.id;

  await db
    .update(webCrawlJobs)
    .set({ fileId, folderId })
    .where(eq(webCrawlJobs.id, jobId));

  await emit(jobId, { step: "embed", message: "Embedding content…" });

  // ── Per-page chunk → embed → upsert with pageUrl attribution ─────────
  // Each page is chunked independently so each vector knows exactly which page
  // it came from. This enables SourceCard to show the specific page URL.
  const pageChunkResults = await Promise.all(
    allPageData
      .filter((p) => p.bodyText.trim())
      .map(async (page) => ({
        page,
        chunks: await chunkText(page.bodyText, "md"),
      })),
  );

  const allChunks = pageChunkResults.flatMap(({ page, chunks }) =>
    chunks.map((content) => ({
      content,
      pageUrl: page.url,
      pageTitle: page.title || domain,
    })),
  );

  // Prepend a dedicated contact-info chunk so emails/phones/socials are
  // always retrievable even if they don't appear in Readability body text.
  const allEmails = [...new Set(allPageData.flatMap((p) => p.emails))];
  const allPhones = [...new Set(allPageData.flatMap((p) => p.phones))];
  const allSocials: Record<string, string> = {};
  for (const page of allPageData) {
    for (const [name, url] of Object.entries(page.socials)) {
      if (!allSocials[name]) allSocials[name] = url;
    }
  }
  if (allEmails.length > 0 || allPhones.length > 0 || Object.keys(allSocials).length > 0) {
    const lines = [`Contact information for ${domain}:`];
    if (allEmails.length > 0) lines.push(`Emails: ${allEmails.join(", ")}`);
    if (allPhones.length > 0) lines.push(`Phones: ${allPhones.join(", ")}`);
    for (const [name, url] of Object.entries(allSocials)) lines.push(`${name}: ${url}`);
    allChunks.unshift({ content: lines.join("\n"), pageUrl: rootUrl, pageTitle: domain });
  }

  if (allChunks.length === 0) throw new Error("No content to embed");

  // Embed with the owner's embedding config so crawled-site chunks share the
  // vector space their queries are embedded in at chat time.
  const { embedding } = await getUserAiConfig(userId);
  if (!embedding) {
    throw new Error(
      "No embedding key configured. Add a Google or OpenAI key in Settings before importing a site.",
    );
  }
  const embeddings = await embedTexts(allChunks.map((c) => c.content), embedding);

  const vectors = allChunks.map((chunk, i) => ({
    id: `${fileId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      fileId,
      fileName: chunk.pageTitle,
      fileType: "web",
      folderId,
      folderPath: domain,
      chunkIndex: i,
      tags: [],
      size: new TextEncoder().encode(chunk.content).length,
      preview: chunk.content.slice(0, 200),
      content: chunk.content,
      pageUrl: chunk.pageUrl,
    } satisfies ChunkMetadata,
  }));

  await upsertChunks(userId, vectors);

  const dbRows = allChunks.map((chunk, i) => ({
    fileId,
    content: chunk.content,
    chunkIndex: i,
    pineconeId: `${fileId}-chunk-${i}`,
  }));

  await db.insert(fileChunks).values(dbRows);
  await db.update(files).set({ status: "ready" }).where(eq(files.id, fileId));
  await db
    .update(webCrawlJobs)
    .set({ status: "done", processedPages: total })
    .where(eq(webCrawlJobs.id, jobId));

  await emit(jobId, {
    step: "done",
    message: `${total} pages imported — ready to chat!`,
    processedPages: total,
    totalPages: total,
    fileId,
    folderId,
    done: true,
  });

  return { jobId, fileId, pages: total };
}

/**
 * Marks a crawl job as errored and notifies the client. Used by the Inngest
 * onFailure handler and the inline path's catch.
 */
export async function markCrawlError(jobId: string, message: string): Promise<void> {
  await db
    .update(webCrawlJobs)
    .set({ status: "error", errorMessage: message })
    .where(eq(webCrawlJobs.id, jobId));
  await emit(jobId, { step: "error", message: "Crawl failed", error: message });
}
