import { eq } from "drizzle-orm";
import { db } from "./database";
import { decryptSecret } from "./encryption";
import { userAiSettings } from "@/db/schema";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_LLM_MODEL,
  type EmbedProvider,
  type LlmProvider,
} from "./ai-providers";

/** UI-facing AI settings status — never includes raw keys, only masked hints. */
export interface AiStatus {
  hasLlmKey: boolean;
  llmProvider: LlmProvider | null;
  llmLast4: string | null;
  llmModel: string | null;
  llmTemperature: number;
  hasEmbeddingKey: boolean;
  embeddingProvider: EmbedProvider | null;
  embeddingLast4: string | null;
  embeddingModel: string | null;
  /** True when the LLM is Anthropic but no embedding key has been added yet. */
  needsEmbeddingKey: boolean;
}

export interface ResolvedLlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface ResolvedEmbeddingConfig {
  provider: EmbedProvider;
  apiKey: string;
  model: string;
}

export interface UserAiConfig {
  /** null when the user hasn't added an LLM key yet. */
  llm: ResolvedLlmConfig | null;
  /** null when embeddings aren't configured (e.g. Anthropic with no 2nd key). */
  embedding: ResolvedEmbeddingConfig | null;
}

/** Safely decrypts a stored key; returns undefined if it can't be read. */
function safeDecrypt(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decryptSecret(value);
  } catch {
    return undefined;
  }
}

/**
 * Resolves a user's bring-your-own-key AI configuration (decrypted), applying
 * default models where unset. Both `llm` and `embedding` are required for RAG;
 * callers should handle either being null.
 */
export async function getUserAiConfig(userId: string): Promise<UserAiConfig> {
  const [row] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);

  if (!row) return { llm: null, embedding: null };

  const llmKey = safeDecrypt(row.llmApiKey);
  const embKey = safeDecrypt(row.embeddingApiKey);

  const llm: ResolvedLlmConfig | null =
    llmKey && row.llmProvider
      ? {
          provider: row.llmProvider as LlmProvider,
          apiKey: llmKey,
          model: row.llmModel ?? DEFAULT_LLM_MODEL[row.llmProvider as LlmProvider],
          temperature: row.llmTemperature,
        }
      : null;

  const embedding: ResolvedEmbeddingConfig | null =
    embKey && row.embeddingProvider
      ? {
          provider: row.embeddingProvider as EmbedProvider,
          apiKey: embKey,
          model:
            row.embeddingModel ??
            DEFAULT_EMBEDDING_MODEL[row.embeddingProvider as EmbedProvider],
        }
      : null;

  return { llm, embedding };
}

/** Builds the UI-facing status (masked) for the settings page. */
export async function getUserAiStatus(userId: string): Promise<AiStatus> {
  const [row] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);

  if (!row) {
    return {
      hasLlmKey: false,
      llmProvider: null,
      llmLast4: null,
      llmModel: null,
      llmTemperature: 0.3,
      hasEmbeddingKey: false,
      embeddingProvider: null,
      embeddingLast4: null,
      embeddingModel: null,
      needsEmbeddingKey: false,
    };
  }

  const llmKey = safeDecrypt(row.llmApiKey);
  const embKey = safeDecrypt(row.embeddingApiKey);
  const llmProvider = row.llmProvider as LlmProvider | null;
  const embeddingProvider = row.embeddingProvider as EmbedProvider | null;

  return {
    hasLlmKey: !!llmKey,
    llmProvider: llmKey ? llmProvider : null,
    llmLast4: llmKey ? llmKey.slice(-4) : null,
    llmModel:
      row.llmModel ?? (llmProvider ? DEFAULT_LLM_MODEL[llmProvider] : null),
    llmTemperature: row.llmTemperature,
    hasEmbeddingKey: !!embKey,
    embeddingProvider: embKey ? embeddingProvider : null,
    embeddingLast4: embKey ? embKey.slice(-4) : null,
    embeddingModel:
      row.embeddingModel ??
      (embeddingProvider ? DEFAULT_EMBEDDING_MODEL[embeddingProvider] : null),
    needsEmbeddingKey: !!llmKey && llmProvider === "anthropic" && !embKey,
  };
}
