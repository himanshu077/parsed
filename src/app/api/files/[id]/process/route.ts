import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { files } from "@/db/schema";
import { inngest } from "@/lib/inngest";
import {
  runFileProcessing,
  markProcessingError,
  INNGEST_DISABLED,
} from "@/lib/file-processing";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [file] = await db
    .select({ id: files.id, userId: files.userId })
    .from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))
    .limit(1);

  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  try {
    if (INNGEST_DISABLED) {
      const userId = session.user.id;
      after(() =>
        runFileProcessing(file.id, userId).catch((e) =>
          markProcessingError(
            file.id,
            e instanceof Error ? e.message : "Processing failed",
          ),
        ),
      );
    } else {
      await inngest.send({
        name: "file/uploaded",
        data: { fileId: file.id, userId: session.user.id },
      });
    }
  } catch (e) {
    await markProcessingError(
      file.id,
      e instanceof Error ? e.message : "Failed to start processing",
    );
    return Response.json({ error: "Failed to start processing" }, { status: 502 });
  }

  return Response.json({ queued: true });
}
