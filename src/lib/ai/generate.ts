import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { getLLMModelFor, getLLMProviderChain } from "./llm";
import { LLM_MODEL_FALLBACKS, LLM_TEMPERATURE } from "./config";
import type { LLMProvider } from "./config";

export interface FallbackStream {
  /** The provider that actually produced the stream. */
  provider: LLMProvider;
  /** Text deltas from the winning provider. */
  textStream: AsyncIterable<string>;
}

/**
 * Streams a generation, automatically failing over if the first choice is
 * unavailable. Two axes of failover:
 *   - For a user's own key: primary model → the provider's fallback models
 *     (same key), covering a retired/overloaded/rate-limited default model.
 *   - For the env-configured path: across the provider chain (primary → fallback
 *     provider), covering an unreachable host.
 *
 * Failover is decided on the FIRST token: each attempt's stream is started and
 * the first chunk awaited. If that throws (e.g. a 503 "overloaded" or a dead
 * host), the next attempt is tried. Once tokens start flowing we commit to that
 * attempt — a mid-stream failure can't be failed over (output is already
 * partially sent) and surfaces to the caller instead.
 *
 * Time-to-first-token is unchanged on the happy path (we always await the first
 * token anyway); only a failing first choice adds latency before switching.
 */
export async function streamTextWithFallback(params: {
  system: string;
  messages: ModelMessage[];
  /** Aborts server-side generation when the client stops the response. */
  abortSignal?: AbortSignal;
  /**
   * A user's own LLM config (provider + key + model + temperature). When set,
   * generation uses exactly that provider/key and skips failover (a fallback
   * provider wouldn't have this key).
   */
  llm?: {
    provider: LLMProvider;
    apiKey: string;
    model?: string;
    temperature?: number;
  };
}): Promise<FallbackStream> {
  // Build the ordered list of (provider, model) attempts.
  //  - user key: one provider, primary model + that provider's fallback models.
  //  - env path: the provider chain, each with its own default model.
  const attempts: { provider: LLMProvider; model?: string }[] = params.llm
    ? [
        params.llm.model,
        ...LLM_MODEL_FALLBACKS[params.llm.provider],
      ]
        .filter((m, i, a) => a.indexOf(m) === i) // dedupe (primary may equal a fallback)
        .map((model) => ({ provider: params.llm!.provider, model }))
    : getLLMProviderChain().map((provider) => ({ provider }));

  let lastError: unknown;

  for (const { provider, model } of attempts) {
    try {
      const result = streamText({
        model: params.llm
          ? getLLMModelFor(provider, { apiKey: params.llm.apiKey, model })
          : getLLMModelFor(provider),
        temperature: params.llm?.temperature ?? LLM_TEMPERATURE,
        // Fail over quickly rather than exhausting long internal retries on a
        // dead host, while still tolerating a single transient blip.
        maxRetries: 1,
        abortSignal: params.abortSignal,
        system: params.system,
        messages: params.messages,
      });

      const iterator = result.textStream[Symbol.asyncIterator]();
      const first = await iterator.next(); // throws here if this attempt is unavailable

      async function* stream(): AsyncGenerator<string> {
        if (!first.done && first.value) yield first.value;
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          if (next.value) yield next.value;
        }
      }

      return { provider, textStream: stream() };
    } catch (error) {
      // A user-initiated stop (abort) must not fail over to another attempt.
      if (
        params.abortSignal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      lastError = error;
      console.error(
        `[ai] LLM attempt failed (provider="${provider}" model="${model ?? "default"}"); trying next:`,
        error,
      );
    }
  }

  throw lastError ?? new Error("No LLM provider available");
}
