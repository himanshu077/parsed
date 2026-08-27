export type LLMProvider = "anthropic" | "openai" | "google" | "ollama";
export type EmbeddingProvider = "openai" | "google" | "ollama";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export const LLM_CONFIG = {
  provider: (process.env.LLM_PROVIDER ?? "google") as LLMProvider,
  model: process.env.LLM_MODEL as string | undefined,
};

// Optional automatic failover for generation: if the primary LLM provider is
// unreachable (e.g. the self-hosted Ollama host is down), generation retries on
// this provider. Defaults to "openai" when the primary isn't already OpenAI.
// Only engages if the fallback provider's credentials are configured.
export const LLM_FALLBACK_PROVIDER =
  (process.env.LLM_FALLBACK_PROVIDER as LLMProvider | undefined) || undefined;

// Low temperature keeps answers grounded in the retrieved context rather than
// improvising — important for RAG faithfulness, especially on smaller models.
export const LLM_TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? 0.3);

// How answers are produced:
//   generative — retrieve context, then an LLM writes the answer (default)
//   extractive — no LLM; return the best-matching sentences verbatim from the
//                retrieved documents, ranked with the embedding model. Grounded,
//                deterministic, and cheaper, but no synthesis across sources.
export const ANSWER_MODE = (process.env.ANSWER_MODE ?? "generative") as
  | "generative"
  | "extractive";

export const EMBEDDING_CONFIG = {
  provider: (process.env.EMBEDDING_PROVIDER ?? "google") as EmbeddingProvider,
  model: process.env.EMBEDDING_MODEL as string | undefined,
};

export const DEFAULT_LLM_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  ollama: "llama3.1:8b",
};

export const DEFAULT_EMBEDDING_MODELS: Record<EmbeddingProvider, string> = {
  openai: "text-embedding-3-small",
  google: "gemini-embedding-001",
  ollama: "nomic-embed-text",
};
