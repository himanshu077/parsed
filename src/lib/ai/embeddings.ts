import OpenAI from "openai";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import {
  EMBEDDING_CONFIG,
  DEFAULT_EMBEDDING_MODELS,
  OLLAMA_BASE_URL,
} from "./config";

const BATCH_SIZE = 100;
// Ollama runs locally on modest hardware. Large embedding batches have been
// observed to crash the local server mid-crawl (OOM → ECONNREFUSED), so send it
// far fewer texts per request than hosted providers, which handle 100 fine.
const OLLAMA_BATCH_SIZE = 16;

// Embeddings intentionally do NOT fail over to a different provider: the vector
// index is tied to one embedding model's dimensions and vector space, so a
// query embedded by a different model can't match stored vectors. The correct
// resilience here is a bounded retry against the SAME provider — with enough
// backoff to survive a brief local-server restart.
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 1000,
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
  const batchSize = provider === "ollama" ? OLLAMA_BATCH_SIZE : BATCH_SIZE;

  if (provider === "google") {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
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
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
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
