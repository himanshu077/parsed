"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LlmProvider = "google" | "openai" | "anthropic";
export type EmbedProvider = "google" | "openai";

export interface AiStatus {
  hasLlmKey: boolean;
  llmProvider: LlmProvider | null;
  llmLast4: string | null;
  llmModel: string | null;
  llmTemperature: number;
  hasEmbeddingKey: boolean;
  embeddingProvider: EmbedProvider | null;
  embeddingLast4: string | null;
  embeddingModel: string | null;
  needsEmbeddingKey: boolean;
}

export function useAiStatus() {
  return useQuery<AiStatus>({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ai");
      if (!res.ok) throw new Error("Failed to load AI settings");
      return res.json();
    },
  });
}

export function useSaveAiKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { apiKey: string; embeddingApiKey?: string }) => {
      const res = await fetch("/api/settings/ai/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        throw new Error(error || "Failed to save key");
      }
      return res.json() as Promise<AiStatus>;
    },
    onSuccess: (status) => qc.setQueryData(["ai-settings"], status),
  });
}
