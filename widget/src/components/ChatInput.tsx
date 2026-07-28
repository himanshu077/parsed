import { useRef, useState, useCallback, type KeyboardEvent } from "react";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
  primaryColor: string;
}

export function ChatInput({ onSend, disabled, placeholder, primaryColor }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`; // max 4 rows ~112px
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 bg-white px-3 pb-3 pt-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex-1 resize-none rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-400",
          "focus:bg-zinc-50 focus:ring-2 focus:ring-black/5",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
        )}
        style={{ height: "40px", maxHeight: "112px" }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-opacity",
          canSend ? "opacity-100" : "cursor-not-allowed opacity-30",
        )}
        style={{ backgroundColor: primaryColor }}
      >
        <SendHorizonal className="h-4 w-4" />
      </button>
    </div>
  );
}
