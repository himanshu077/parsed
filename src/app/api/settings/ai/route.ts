import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { getUserAiStatus } from "@/lib/user-ai-config";
import { userAiSettings } from "@/db/schema";

/** GET → current AI settings status (masked; never returns raw keys). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json(await getUserAiStatus(session.user.id));
}

/** DELETE → clear all AI settings (keys + model choices). */
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(userAiSettings).where(eq(userAiSettings.userId, session.user.id));
  return Response.json(await getUserAiStatus(session.user.id));
}
