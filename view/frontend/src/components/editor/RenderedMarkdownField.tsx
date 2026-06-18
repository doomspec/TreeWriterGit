import { useMemo, useRef } from "react";

import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

/** Edit markdown with a live rendered preview above a prose-styled source field. */
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
  showPreview = true,
  approvedBaseline,
  highlightPending = false,
  compact = false,
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
  /** When false, only the prose editor is shown (e.g. tight layouts). */
  showPreview?: boolean;
  /** Last approved text — enables line highlighting when `highlightPending`. */
  approvedBaseline?: string;
  highlightPending?: boolean;
  /** Tighter layout: hide duplicate preview strip above the editor. */
  compact?: boolean;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const baseline = approvedBaseline ?? value;

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const minRows = Math.max(6, lineCount + 1);
  const hasPreview = showPreview && !compact && value.trim().length > 0;

  return (
    <div className={cn("rendered-markdown-field flex w-full flex-col gap-4", className)}>
      {hasPreview ? (
        <div className="rendered-markdown-field__preview-wrap shrink-0 border-b border-border/60 pb-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <MarkdownViewer
            markdown={value}
            className="rendered-markdown-field__preview"
            linkContextPath={linkContextPath}
            linksClickable={linksClickable}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
      <div className="rendered-markdown-field__editor w-full">
        {!hasPreview ? (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Edit
          </p>
        ) : null}
        <HighlightingTextarea
          fillContainer={false}
          inputRef={textareaRef}
          className="rendered-markdown-field__input markdown-reading-edit block w-full min-h-[8rem] p-0 font-serif"
          mirrorClassName="rendered-markdown-field__input markdown-reading-edit block w-full p-0 font-serif"
          value={value}
          baseline={baseline}
          highlight={highlightPending}
          rows={minRows}
          spellCheck={true}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onSelect={onSelect}
          onKeyUp={onSelect}
          onClick={onSelect}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
