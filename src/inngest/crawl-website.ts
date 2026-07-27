import { inngest } from "@/lib/inngest";
import { runWebCrawl, markCrawlError } from "@/lib/web-crawl";

export const crawlWebsite = inngest.createFunction(
  {
    id: "crawl-website",
    retries: 1,
    onFailure: async ({ event, error }) => {
      const { jobId } = event.data.event.data as { jobId: string };
      await markCrawlError(jobId, error.message ?? "Crawl failed");
    },
  },
  { event: "url/crawl.start" },
  async ({ event }) => {
    const { jobId, userId, rootUrl, maxPages = 25 } = event.data as {
      jobId: string;
      userId: string;
      rootUrl: string;
      maxPages?: number;
    };

    return runWebCrawl(jobId, userId, rootUrl, maxPages);
  },
);
