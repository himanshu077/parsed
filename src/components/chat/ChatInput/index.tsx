"use client";

import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  onStop?: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder = "Ask anything about this document…",
  onStop,
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div className="border-t bg-background py-3">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="relative">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={3}
            className="max-h-40 resize-none overflow-y-auto pr-14"
          />
          {isLoading ? (
            <Button
              size="icon"
              variant="secondary"
              onClick={onStop}
              className="absolute bottom-2 right-2 size-9 rounded-lg"
              title="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="absolute bottom-2 right-2 size-9 rounded-lg"
              title="Send"
            >
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
