"use client";

import { useState } from "react";
import { Check, Code2, Copy, Loader2, Play, TestTubeDiagonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolders, buildFolderTree } from "@/hooks";
import type { FolderWithChildren } from "@/types";

/** Removes any previously-mounted widget so re-loading a different folder is clean. */
function unmountExistingWidget() {
  document.getElementById("parsed-widget-root")?.remove();
}

function loadWidgetScript(config: Record<string, string>): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  w.ParsedWidgetConfig = config;

  const existing = w.ParsedWidget as { init?: (c: unknown) => void } | undefined;
  if (existing?.init) {
    existing.init(config);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load /widget.js"));
    document.body.appendChild(s);
  });
}

// Flattens the folder tree into indented options for the select.
function flatten(nodes: FolderWithChildren[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${"  ".repeat(depth)}${n.name}` },
    ...flatten(n.children, depth + 1),
  ]);
}

export default function PlaygroundPage() {
  const { data: flatFolders = [], isLoading } = useFolders();
  const options = flatten(buildFolderTree(flatFolders));

  const [folderId, setFolderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<{ folderId: string; token: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedFolder = flatFolders.find((f) => f.id === folderId);

  const handleLoad = async () => {
    if (!folderId || !selectedFolder) return;
    setLoading(true);
    try {
      // Fetch the folder's widget token; generate one if it doesn't exist yet.
      let token: string | null = null;
      const res = await fetch(`/api/folders/${folderId}/widget-token`);
      if (res.ok) token = (await res.json()).token;
      if (!token) {
        const gen = await fetch(`/api/folders/${folderId}/widget-token`, { method: "POST" });
        if (!gen.ok) throw new Error("Failed to generate widget token");
        token = (await gen.json()).token;
      }
      if (!token) throw new Error("No widget token available");

      const title = `Ask about ${selectedFolder.name}`;
      unmountExistingWidget();
      await loadWidgetScript({
        apiUrl: window.location.origin,
        folderId,
        token,
        title,
      });
      setLoadedFor({ folderId, token, title });
      toast.success("Widget loaded — look for the chat button in the corner");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load widget");
    } finally {
      setLoading(false);
    }
  };

  const embedScript = loadedFor
    ? `<script>
  (function() {
    window.ParsedWidgetConfig = {
      apiUrl: "${window.location.origin}",
      folderId: "${loadedFor.folderId}",
      token: "${loadedFor.token}",
      title: "${loadedFor.title.replace(/"/g, '\\"')}"
    };
    var s = document.createElement('script');
    s.src = "${window.location.origin}/widget.js";
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(embedScript);
      setCopied(true);
      toast.success("Embed script copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy manually");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TestTubeDiagonal className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Widget playground</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Load a folder&apos;s embeddable chat widget right here to test it before
            adding it to your site.
          </p>
        </div>
      </div>

      {/* Controls */}
      <section className="space-y-3 rounded-xl bg-card/60 p-5">
        <label className="text-sm font-medium">Folder</label>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading folders…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no folders yet. Create a folder and upload files to it first.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a folder…" />
              </SelectTrigger>
              <SelectContent className="border border-solid border-zinc-700">
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLoad} disabled={!folderId || loading} className="gap-1.5">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  {loadedFor ? "Reload widget" : "Load widget"}
                </>
              )}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          The widget answers only from the selected folder&apos;s documents. Make sure
          the folder has processed (ready) files.
        </p>
      </section>

      {/* Loaded state */}
      {loadedFor && (
        <section className="space-y-4">
          <div className="rounded-xl bg-primary/10 p-4 text-sm">
            <p className="font-medium">Widget is live on this page.</p>
            <p className="mt-1 text-muted-foreground">
              Look for the floating chat button (usually bottom-right) and ask it a
              question. Choose another folder above and click{" "}
              <span className="font-medium text-foreground">Reload widget</span> to
              switch.
            </p>
          </div>

          {/* Embed snippet */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="size-4" />
              Embed script
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-10 text-xs leading-relaxed">
                <code>{embedScript}</code>
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 size-7"
                onClick={copy}
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into the <code className="rounded bg-muted px-1">&lt;head&gt;</code>{" "}
              or <code className="rounded bg-muted px-1">&lt;body&gt;</code> of any website.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
