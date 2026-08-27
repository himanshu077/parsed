import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { encryptSecret } from "@/lib/encryption";
import { getUserAiStatus } from "@/lib/user-ai-config";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_LLM_MODEL,
  detectProvider,
  supportsEmbeddings,
  type EmbedProvider,
} from "@/lib/ai-providers";
import { userAiSettings } from "@/db/schema";

const bodySchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required").max(300),
  // Only needed when the primary key is Anthropic (which can't embed).
  embeddingApiKey: z.string().trim().max(300).optional(),
});

/**
 * PUT → save the user's LLM key (+ optional embedding key for Anthropic).
 * Providers are auto-detected from the key format. Saving a key resets the
 * selected models to that provider's defaults.
 */
export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { apiKey, embeddingApiKey } = parsed.data;

  const llmProvider = detectProvider(apiKey);
  if (!llmProvider) {
    return Response.json(
      { error: "Unrecognized API key. Use a Google (AIza…), OpenAI (sk-…), or Anthropic (sk-ant-…) key." },
      { status: 400 },
    );
  }

  // Resolve the embedding key/provider.
  let embeddingProvider: EmbedProvider | null = null;
  let embeddingKeyPlain: string | null = null;

  if (supportsEmbeddings(llmProvider)) {
    // Google / OpenAI: one key does both LLM and embeddings.
    embeddingProvider = llmProvider;
    embeddingKeyPlain = apiKey;
  } else if (embeddingApiKey) {
    // Anthropic: a separate Google/OpenAI key is required for embeddings.
    const ep = detectProvider(embeddingApiKey);
    if (!ep || !supportsEmbeddings(ep)) {
      return Response.json(
        { error: "The embedding key must be a Google (AIza…) or OpenAI (sk-…) key." },
        { status: 400 },
      );
    }
    embeddingProvider = ep;
    embeddingKeyPlain = embeddingApiKey;
  }

  let llmApiKeyEnc: string;
  let embeddingApiKeyEnc: string | null;
  try {
    llmApiKeyEnc = encryptSecret(apiKey);
    embeddingApiKeyEnc = embeddingKeyPlain ? encryptSecret(embeddingKeyPlain) : null;
  } catch {
    return Response.json(
      { error: "Server encryption is not configured. Please contact support." },
      { status: 500 },
    );
  }

  const values = {
    userId: session.user.id,
    llmProvider,
    llmApiKey: llmApiKeyEnc,
    llmModel: DEFAULT_LLM_MODEL[llmProvider],
    embeddingProvider,
    embeddingApiKey: embeddingApiKeyEnc,
    embeddingModel: embeddingProvider ? DEFAULT_EMBEDDING_MODEL[embeddingProvider] : null,
  };

  await db
    .insert(userAiSettings)
    .values(values)
    .onConflictDoUpdate({ target: userAiSettings.userId, set: values });

  return Response.json(await getUserAiStatus(session.user.id));
}
