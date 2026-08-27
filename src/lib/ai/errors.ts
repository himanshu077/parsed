// Turns a provider/SDK error into a short, user-facing sentence.
//
// The Vercel AI SDK wraps failures (AI_RetryError → AI_APICallError → cause),
// so the real HTTP status and message are often nested. These helpers dig them
// out and map them to a friendly explanation.

interface WrappedError {
  statusCode?: number;
  message?: string;
  lastError?: WrappedError;
  cause?: WrappedError;
  errors?: WrappedError[];
}

function asWrapped(error: unknown): WrappedError {
  return (error && typeof error === "object" ? error : {}) as WrappedError;
}

/** Finds an HTTP status code anywhere in the wrapped error chain. */
function extractStatus(error: unknown): number | undefined {
  const e = asWrapped(error);
  return (
    e.statusCode ??
    e.lastError?.statusCode ??
    e.cause?.statusCode ??
    (Array.isArray(e.errors)
      ? e.errors.find((x) => x?.statusCode)?.statusCode
      : undefined)
  );
}

/** Collects the message text from the wrapped error chain, lower-cased. */
function extractMessage(error: unknown): string {
  const e = asWrapped(error);
  return [e.message, e.lastError?.message, e.cause?.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Owner-facing message (in-app chat, settings). May reference Settings, since
 * the person seeing it controls the key.
 */
export function describeAiError(error: unknown): string {
  const status = extractStatus(error);
  const text = extractMessage(error);

  if (status === 429 || text.includes("quota") || text.includes("rate limit")) {
    return "Your AI provider is rate-limiting the key (quota reached). Wait a moment, or check your provider plan/billing, then try again.";
  }
  if (
    status === 503 ||
    text.includes("overloaded") ||
    text.includes("high demand") ||
    text.includes("unavailable")
  ) {
    return "The AI model is temporarily overloaded. This is usually brief — please try again in a few seconds.";
  }
  if (
    status === 401 ||
    status === 403 ||
    text.includes("api key") ||
    text.includes("permission") ||
    text.includes("unauthorized")
  ) {
    return "Your AI provider key was rejected (invalid, expired, or lacking access/billing). Update it in Settings and try again.";
  }
  if (
    status === 404 ||
    text.includes("not found") ||
    text.includes("no longer available")
  ) {
    return "The configured AI model isn't available on your key right now. Please try again, or update your key in Settings.";
  }
  return "Sorry — I couldn't generate a response. The AI service may be temporarily unavailable. Please try again in a moment.";
}

/**
 * Visitor-facing message (public widget). Never mentions keys/Settings — the
 * end visitor doesn't own the configuration.
 */
export function describeAiErrorPublic(error: unknown): string {
  const status = extractStatus(error);
  const text = extractMessage(error);

  if (
    status === 429 ||
    status === 503 ||
    text.includes("overloaded") ||
    text.includes("high demand") ||
    text.includes("unavailable") ||
    text.includes("rate limit") ||
    text.includes("quota")
  ) {
    return "The assistant is briefly busy. Please try again in a few seconds.";
  }
  return "Sorry — I couldn't answer that right now. Please try again in a moment.";
}
