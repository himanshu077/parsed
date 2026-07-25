import { inngest } from "@/lib/inngest";
import { runFileProcessing, markProcessingError } from "@/lib/file-processing";

export type { FileProgressData } from "@/lib/file-processing";

export const processFile = inngest.createFunction(
  {
    id: "process-file",
    retries: 3,
    onFailure: async ({ event, error }) => {
      const { fileId } = event.data.event.data as { fileId: string; userId: string };
      await markProcessingError(fileId, error.message ?? "Processing failed");
    },
  },
  { event: "file/uploaded" },
  async ({ event }) => {
    const { fileId, userId } = event.data as { fileId: string; userId: string };
    // The pipeline is idempotent (deterministic vector IDs, delete-before-insert),
    // so a whole-function retry is safe.
    return runFileProcessing(fileId, userId);
  },
);
