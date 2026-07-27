import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { webCrawlJobs } from "@/db/schema";
import { inngest } from "@/lib/inngest";
import { assertPublicUrl } from "@/lib/url-guard";
import { runWebCrawl, markCrawlError } from "@/lib/web-crawl";
import { INNGEST_DISABLED } from "@/lib/file-processing";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

    if (!rawUrl) return Response.json({ error: "URL is required" }, { status: 400 });

    let rootUrl: string;
    try {
      const parsed = await assertPublicUrl(rawUrl);
      rootUrl = parsed.toString();
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Invalid URL" },
        { status: 400 },
      );
    }

    const ALLOWED_MAX_PAGES = [10, 25, 50] as const;
    const requestedMax = typeof body.maxPages === "number" ? body.maxPages : 25;
    const maxPages = ALLOWED_MAX_PAGES.includes(requestedMax as typeof ALLOWED_MAX_PAGES[number])
      ? requestedMax
      : 25;

    const [job] = await db
      .insert(webCrawlJobs)
      .values({ userId: session.user.id, rootUrl, status: "pending" })
      .returning();

    // Kick off the crawl. In prod, dispatch to the Inngest background job.
    // Locally (Inngest dev-server binary blocked), run inline via after().
    try {
      if (INNGEST_DISABLED) {
        const jobId = job.id;
        const userId = session.user.id;
        after(() =>
          runWebCrawl(jobId, userId, rootUrl, maxPages).catch((e) => {
            console.error("[import-url] inline crawl failed:", e);
            return markCrawlError(
              jobId,
              e instanceof Error ? e.message : "Crawl failed",
            );
          }),
        );
      } else {
        await inngest.send({
          name: "url/crawl.start",
          data: { jobId: job.id, userId: session.user.id, rootUrl, maxPages },
        });
      }
    } catch (e) {
      // Dispatch failed — mark the job errored instead of leaving it "pending".
      await markCrawlError(
        job.id,
        e instanceof Error ? e.message : "Failed to start crawl",
      );
      return Response.json({ error: "Failed to start crawl" }, { status: 502 });
    }

    return Response.json({ jobId: job.id }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const jobs = await db
      .select()
      .from(webCrawlJobs)
      .where(eq(webCrawlJobs.userId, session.user.id))
      .orderBy(desc(webCrawlJobs.createdAt))
      .limit(20);

    return Response.json(jobs);
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
