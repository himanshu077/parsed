"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiStatus } from "@/hooks";

/**
 * Shown on the dashboard until the user has a working AI setup. Chat and the
 * widget can't answer without an LLM key (and an embedding key), so this points
 * the user to Settings.
 */
export function AiKeyBanner() {
  const { data: status, isLoading } = useAiStatus();

  if (isLoading || !status) return null;
  const ready = status.hasLlmKey && status.hasEmbeddingKey;
  if (ready) return null;

  const message = !status.hasLlmKey
    ? "Parsed needs an AI key to embed documents and answer questions. Add your Gemini, OpenAI, or Anthropic key in Settings to get started."
    : "Your Anthropic key can't create embeddings. Add a Google or OpenAI key in Settings so document search works.";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <KeyRound className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {!status.hasLlmKey ? "Add your AI key to get started" : "Add an embedding key"}
        </p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild size="sm">
        <Link href="/settings">Open Settings</Link>
      </Button>
    </div>
  );
}
