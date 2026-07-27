import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { getLLMModelFor, getLLMProviderChain } from "./llm";
import { LLM_TEMPERATURE } from "./config";
import type { LLMProvider } from "./config";

export interface FallbackStream {
  /** The provider that actually produced the stream. */
  provider: LLMProvider;
  /** Text deltas from the winning provider. */
  textStream: AsyncIterable<string>;
}

/**
 * Streams a generation, automatically failing over across the provider chain
 * (primary → fallback) if a provider is unreachable.
 *
 * Failover is decided on the FIRST token: each provider's stream is started and
 * the first chunk awaited. If that throws (e.g. the Ollama host is down), the
 * next provider is tried. Once tokens start flowing we commit to that provider —
 * a mid-stream failure can't be failed over (output is already partially sent)
 * and surfaces to the caller instead.
 *
 * Time-to-first-token is unchanged on the happy path (we always await the first
 * token anyway); only a dead primary adds latency before switching.
 */
export async function streamTextWithFallback(params: {
  system: string;
  messages: ModelMessage[];
  /** Aborts server-side generation when the client stops the response. */
  abortSignal?: AbortSignal;
}): Promise<FallbackStream> {
  const chain = getLLMProviderChain();
  let lastError: unknown;

  for (const provider of chain) {
    try {
      const result = streamText({
        model: getLLMModelFor(provider),
        temperature: LLM_TEMPERATURE,
        // Fail over quickly rather than exhausting long internal retries on a
        // dead host, while still tolerating a single transient blip.
        maxRetries: 1,
        abortSignal: params.abortSignal,
        system: params.system,
        messages: params.messages,
      });

      const iterator = result.textStream[Symbol.asyncIterator]();
      const first = await iterator.next(); // throws here if the provider is unreachable

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
      // A user-initiated stop (abort) must not fail over to another provider.
      if (
        params.abortSignal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      lastError = error;
      console.error(
        `[ai] LLM provider "${provider}" failed to start; falling over:`,
        error,
      );
    }
  }

  throw lastError ?? new Error("No LLM provider available");
}
