import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import {
  LLM_CONFIG,
  LLM_FALLBACK_PROVIDER,
  DEFAULT_LLM_MODELS,
  OLLAMA_BASE_URL,
} from "./config";
import type { LLMProvider } from "./config";

/** Builds a LanguageModel for a specific provider. */
export function getLLMModelFor(provider: LLMProvider): LanguageModel {
  // The LLM_MODEL override only applies to the primary provider; a fallback
  // provider uses its own default model (a llama tag wouldn't map to OpenAI).
  const resolvedModel =
    (provider === LLM_CONFIG.provider ? LLM_CONFIG.model : undefined) ??
    DEFAULT_LLM_MODELS[provider];

  switch (provider) {
    case "anthropic":
      return anthropic(resolvedModel);

    case "openai":
      return createOpenAI()(resolvedModel);

    case "google":
      return google(resolvedModel);

    case "ollama": {
      const ollamaProvider = createOpenAI({
        baseURL: `${OLLAMA_BASE_URL}/v1`,
        apiKey: "ollama",
      });
      return ollamaProvider(resolvedModel);
    }

    default:
      throw new Error(
        `Unsupported LLM provider: "${provider}". Valid options: anthropic, openai, google, ollama`,
      );
  }
}

/** The primary configured LLM model. */
export function getLLMModel(): LanguageModel {
  return getLLMModelFor(LLM_CONFIG.provider);
}

/** True if the provider has the credentials it needs to run. */
function hasProviderCreds(provider: LLMProvider): boolean {
  switch (provider) {
    case "ollama":
      return true; // local/self-hosted — reachability is handled at call time
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    default:
      return false;
  }
}

/**
 * Ordered list of providers to try for generation: the primary first, then the
 * configured fallback (default OpenAI) if its credentials are present. A single
 * entry means no failover is configured.
 */
export function getLLMProviderChain(): LLMProvider[] {
  const primary = LLM_CONFIG.provider;
  const fallback =
    LLM_FALLBACK_PROVIDER ?? (primary !== "openai" ? "openai" : undefined);

  const chain: LLMProvider[] = [primary];
  if (fallback && fallback !== primary && hasProviderCreds(fallback)) {
    chain.push(fallback);
  }
  return chain;
}
