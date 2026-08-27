// Per-user AI provider detection.
//
// Keys are auto-detected by prefix. Each provider uses a fixed default model
// (see below). Anthropic is LLM-only (no embeddings API).

export type LlmProvider = "google" | "openai" | "anthropic";
export type EmbedProvider = "google" | "openai";

/** Detects the provider from an API key's format, or null if unrecognized. */
export function detectProvider(key: string): LlmProvider | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic"; // must precede the sk- check
  if (k.startsWith("AIza")) return "google";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

/** Whether a provider can produce embeddings (Anthropic cannot). */
export function supportsEmbeddings(p: LlmProvider): p is EmbedProvider {
  return p === "google" || p === "openai";
}

export const DEFAULT_LLM_MODEL: Record<LlmProvider, string> = {
  google: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
};

export const DEFAULT_EMBEDDING_MODEL: Record<EmbedProvider, string> = {
  google: "gemini-embedding-001",
  openai: "text-embedding-3-small",
};
