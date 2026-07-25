import OpenAI from "openai";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import {
  EMBEDDING_CONFIG,
  DEFAULT_EMBEDDING_MODELS,
  OLLAMA_BASE_URL,
} from "./config";

const BATCH_SIZE = 100;

// Embeddings intentionally do NOT fail over to a different provider: the vector
// index is tied to one embedding model's dimensions and vector space, so a
// query embedded by a different model can't match stored vectors. The correct
// resilience here is a bounded retry against the SAME provider for transient
// network blips.
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { provider, model } = EMBEDDING_CONFIG;
  const resolvedModel = model ?? DEFAULT_EMBEDDING_MODELS[provider];

  if (provider === "google") {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const { embeddings: batchEmbeddings } = await withRetry(() =>
        embedMany({
          model: google.embedding(resolvedModel),
          values: batch,
          providerOptions: { google: { outputDimensionality: 768 } },
        }),
      );
      embeddings.push(...batchEmbeddings);
    }
    return embeddings;
  }

  // openai + ollama — both speak the OpenAI embeddings API
  const client =
    provider === "ollama"
      ? new OpenAI({ baseURL: `${OLLAMA_BASE_URL}/v1`, apiKey: "ollama" })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await withRetry(() =>
      client.embeddings.create({
        model: resolvedModel,
        input: batch,
      }),
    );
    embeddings.push(...response.data.map((d) => d.embedding));
  }
  return embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
