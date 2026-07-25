import { cosineSimilarity } from "ai";
import { hybridSearch } from "./hybrid-search";
import type { HybridMatch } from "./hybrid-search";
import { embedText, embedTexts } from "./embeddings";
import { trimToTokenLimit } from "./tokens";
import type { Source } from "@/types/chat.types";

const FINAL_TOP_K = 5;         // chunks sent to LLM after reranking
const MAX_CONTEXT_TOKENS = 6000; // ~24 000 chars — safe ceiling for all providers

const NOT_FOUND = "I don't have that information in the provided documents.";

export interface RagResult {
  context: string;
  sources: Source[];
}

export interface ExtractiveResult {
  answer: string;
  sources: Source[];
}

function matchToSource(m: HybridMatch, score: number): Source {
  return {
    fileId: m.fileId,
    fileName: m.fileName,
    fileType: m.fileType,
    folderPath: m.folderPath,
    size: m.size,
    preview: m.content.slice(0, 200),
    chunkIndex: m.chunkIndex,
    score,
    pageUrl: m.pageUrl,
  };
}

// ── Jina reranker ─────────────────────────────────────────────────────────────

async function rerank(
  query: string,
  documents: string[],
  topN: number,
): Promise<number[]> {
  const key = process.env.JINA_API_KEY;
  if (!key || documents.length <= 3) {
    return documents.map((_, i) => i).slice(0, topN);
  }

  const res = await fetch("https://api.jina.ai/v1/rerank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "jina-reranker-v2-base-multilingual",
      query,
      documents,
      top_n: topN,
    }),
  });

  if (!res.ok) {
    return documents.map((_, i) => i).slice(0, topN);
  }

  const data = await res.json() as {
    results: { index: number; relevance_score: number }[];
  };

  return data.results.map((r) => r.index);
}

// ── Main retrieval pipeline ───────────────────────────────────────────────────

export async function retrieveContext(
  query: string,
  userId: string,
  options: { fileIds?: string[]; topK?: number } = {},
): Promise<RagResult> {
  const { fileIds, topK = FINAL_TOP_K } = options;

  // 1. Hybrid search — vector + keyword, merged via RRF
  const candidates = await hybridSearch(query, userId, { fileIds });

  if (candidates.length === 0) {
    return {
      context: "No relevant content found in the uploaded documents.",
      sources: [],
    };
  }

  // 2. Rerank — Jina picks the best chunks from the RRF candidate pool
  const rankedIndices = await rerank(
    query,
    candidates.map((c) => c.content),
    Math.min(topK, candidates.length),
  );
  const reranked = rankedIndices.map((i) => candidates[i]);

  // 3. Token budget — drop trailing chunks if context would overflow
  const finalMatches = trimToTokenLimit(reranked, MAX_CONTEXT_TOKENS);

  // 4. Build sources — deduplicated by fileId (highest RRF score per file)
  const sourceMap = new Map<string, Source>();
  for (const m of finalMatches) {
    const source = matchToSource(m, m.rrfScore);
    const existing = sourceMap.get(source.fileId);
    if (!existing || existing.score < source.score) {
      sourceMap.set(source.fileId, source);
    }
  }

  const context = finalMatches
    .map((m) => `<document>\n${m.content}\n</document>`)
    .join("\n\n");

  return {
    context,
    sources: Array.from(sourceMap.values()),
  };
}

// ── Extractive answering (no LLM) ─────────────────────────────────────────────

const EXTRACTIVE_POOL = 8; // top chunks to mine sentences from
const EXTRACTIVE_TOP_N = 3; // sentences returned in the answer
const EXTRACTIVE_MIN_SCORE = 0.4; // best-sentence similarity floor → else "not found"

/** Splits text into trimmed sentences on sentence-ending punctuation. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Answers without an LLM: retrieves candidate chunks, splits them into
 * sentences, and returns the sentences most similar to the query — ranked with
 * the embedding model already in use. Verbatim (no hallucination), deterministic,
 * and cheap, at the cost of synthesis across sources.
 */
export async function retrieveExtractiveAnswer(
  query: string,
  userId: string,
  options: { fileIds?: string[] } = {},
): Promise<ExtractiveResult> {
  const candidates = await hybridSearch(query, userId, { fileIds: options.fileIds });
  if (candidates.length === 0) return { answer: NOT_FOUND, sources: [] };

  const pool = candidates.slice(0, EXTRACTIVE_POOL);
  const sentences: { text: string; match: HybridMatch }[] = [];
  for (const c of pool) {
    for (const s of splitSentences(c.content)) {
      if (s.length >= 20) sentences.push({ text: s, match: c });
    }
  }

  // No usable sentences (e.g. tabular/short content) — return the best chunk.
  if (sentences.length === 0) {
    const best = pool[0];
    return {
      answer: best.content.slice(0, 500),
      sources: [matchToSource(best, best.rrfScore)],
    };
  }

  const [queryVec, sentenceVecs] = await Promise.all([
    embedText(query),
    embedTexts(sentences.map((s) => s.text)),
  ]);

  const scored = sentences
    .map((s, i) => ({ ...s, score: cosineSimilarity(queryVec, sentenceVecs[i]) }))
    .sort((a, b) => b.score - a.score);

  if (scored[0].score < EXTRACTIVE_MIN_SCORE) {
    return { answer: NOT_FOUND, sources: [] };
  }

  const chosen = scored.slice(0, EXTRACTIVE_TOP_N);
  const answer = chosen.map((s) => s.text).join(" ");

  const sourceMap = new Map<string, Source>();
  for (const s of chosen) {
    const src = matchToSource(s.match, s.score);
    const existing = sourceMap.get(src.fileId);
    if (!existing || existing.score < src.score) sourceMap.set(src.fileId, src);
  }

  return { answer, sources: Array.from(sourceMap.values()) };
}

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(context: string): string {
  return `You are a helpful assistant that answers questions strictly from the provided documents.

Instructions:
- Read each <document> carefully.
- Answer using only facts that appear in the documents.
- Give a direct, conversational answer — do not dump raw data.
- If the documents do not contain the answer, respond with: "I don't have that information in the provided documents."
- Never use knowledge from outside the documents.

${context}`;
}
