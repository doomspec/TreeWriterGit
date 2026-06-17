import { useCallback, useRef } from "react";

import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

/** Edit markdown with a live rendered backdrop (Typora-style overlay). */
export function RenderedMarkdownField({
  value,
  onChange,
  onSelect,
  onKeyDown,
  className,
  placeholder = "Write here…",
  ariaLabel,
  linkContextPath = "",
  linksClickable = false,
  onNavigate,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  linkContextPath?: string;
  linksClickable?: boolean;
  onNavigate?: (target: NavigateTarget) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) return;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }, [textareaRef]);

  const showBackdrop = value.trim().length > 0;

  return (
    <div className={cn("rendered-markdown-field relative min-h-[12rem] flex-1", className)}>
      <div
        ref={backdropRef}
        className="rendered-markdown-field__backdrop pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {showBackdrop ? (
          <MarkdownViewer
            markdown={value}
            className="rendered-markdown-field__preview"
            linkContextPath={linkContextPath}
            linksClickable={linksClickable}
            onNavigate={onNavigate}
          />
        ) : (
          <p className="text-muted-foreground/50">{placeholder}</p>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="rendered-markdown-field__input markdown-reading-edit relative z-[1] block w-full min-h-full resize-none border-0 bg-transparent p-0 outline-none focus:ring-0 focus-visible:outline-none"
        value={value}
        spellCheck={true}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onSelect={onSelect}
        onKeyUp={onSelect}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
      />
    </div>
  );
}
