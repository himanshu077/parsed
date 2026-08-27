"use client";

import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { detectProvider } from "@/lib/ai-providers";
import { useAiStatus, useSaveAiKeys } from "@/hooks";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

function KeyInput({
  id,
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        className="pr-10"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide key" : "Show key"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AiKeyCard() {
  const { data: status, isLoading } = useAiStatus();
  const save = useSaveAiKeys();

  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");

  const detected = apiKey.trim() ? detectProvider(apiKey) : null;
  const isAnthropic = detected === "anthropic";
  const invalidFormat = apiKey.trim().length > 0 && detected === null;

  // Editing when explicitly toggled, or when no key exists yet.
  const isEditing = editing || (!isLoading && !status?.hasLlmKey);

  const canSave =
    !!detected &&
    !invalidFormat &&
    (!isAnthropic || embeddingApiKey.trim().length > 0);

  const submit = async () => {
    if (!canSave) return;
    try {
      await save.mutateAsync({
        apiKey: apiKey.trim(),
        embeddingApiKey: isAnthropic ? embeddingApiKey.trim() : undefined,
      });
      setApiKey("");
      setEmbeddingApiKey("");
      setEditing(false);
      toast.success("API key saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">AI provider key</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a Google Gemini, OpenAI, or Anthropic key. The provider is detected
            automatically. Anthropic keys also need a Google/OpenAI key for search
            (embeddings), which Anthropic doesn&apos;t provide.
          </p>
        </div>
      </div>

      {isLoading || !status ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : isEditing ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="api-key">API key</Label>
            <KeyInput
              id="api-key"
              value={apiKey}
              onChange={setApiKey}
              placeholder="AIza… / sk-… / sk-ant-…"
              onEnter={submit}
            />
            {invalidFormat ? (
              <p className="text-xs text-destructive">
                Unrecognized key format. Use a Google (AIza…), OpenAI (sk-…), or
                Anthropic (sk-ant-…) key.
              </p>
            ) : detected ? (
              <p className="text-xs text-muted-foreground">
                Detected: <span className="font-medium text-foreground">{PROVIDER_LABEL[detected]}</span>
              </p>
            ) : null}
          </div>

          {isAnthropic && (
            <div className="grid gap-2">
              <Label htmlFor="embedding-key">Embedding key (Google or OpenAI)</Label>
              <KeyInput
                id="embedding-key"
                value={embeddingApiKey}
                onChange={setEmbeddingApiKey}
                placeholder="AIza… or sk-…"
                onEnter={submit}
              />
              <p className="text-xs text-muted-foreground">
                Required because Anthropic can&apos;t create embeddings for document
                search.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={!canSave || save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {save.isPending ? "Saving…" : "Save key"}
            </Button>
            {status.hasLlmKey && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setApiKey("");
                  setEmbeddingApiKey("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>API key</Label>
            <Input
              disabled
              value={`${PROVIDER_LABEL[status.llmProvider ?? ""] ?? "Key"} ••••••••${status.llmLast4 ?? ""}`}
            />
          </div>

          {status.needsEmbeddingKey && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p>
                Your Anthropic key can&apos;t create embeddings. Click{" "}
                <span className="font-medium">Edit / Update key</span> and add a
                Google or OpenAI embedding key so document search works.
              </p>
            </div>
          )}

          <div>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit / Update key
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
