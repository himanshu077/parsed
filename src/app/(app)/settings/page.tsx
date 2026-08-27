"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { AiKeyCard } from "@/components/settings";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the API key and models that power your document chat.
          </p>
        </div>
      </div>

      <AiKeyCard />
    </div>
  );
}
