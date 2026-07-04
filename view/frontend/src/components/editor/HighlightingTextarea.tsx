import { Fragment, useCallback, useMemo, useRef } from "react";

import {
  pendingCurrentLineHighlightRows,
  splitLines,
  type PendingLineHighlight,
} from "@/lib/draftDiff";
import {
  hasRawTextHighlights,
  splitRawMirrorLine,
  type RawMirrorPart,
} from "@/lib/textHighlight";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type HighlightRow = PendingLineHighlight;

function mirrorPartsWithPendingClass(parts: RawMirrorPart[], pendingClass?: string): RawMirrorPart[] {
  if (!pendingClass) return parts;
  return parts.map((part) => ({ ...part, pendingClass: pendingClass ?? part.pendingClass }));
}

function lineMirrorParts(line: string, row: HighlightRow): RawMirrorPart[] {
  if (row.kind === "inline") {
    return row.segments.flatMap((segment) => {
      const pendingClass =
        segment.kind === "insert"
          ? "highlight-inline--pending"
          : segment.kind === "delete"
            ? "highlight-inline--deleted"
            : undefined;
      return mirrorPartsWithPendingClass(splitRawMirrorLine(segment.text), pendingClass);
    });
  }
  if (row.kind === "full") {
    return [{ text: line, pendingClass: "highlight-line--pending" }];
  }
  if (row.kind === "delete") {
    return [{ text: line, pendingClass: "highlight-inline--deleted" }];
  }
  return splitRawMirrorLine(line);
}

function renderMirrorParts(parts: RawMirrorPart[], keyPrefix: string) {
  return parts.map((part, partIndex) => {
    if (!part.text) return null;
    const className = cn(
      part.highlightColor ? `text-highlight-badge text-highlight-${part.highlightColor}` : undefined,
      part.pendingClass,
    );
    return (
      <span key={`${keyPrefix}-${partIndex}`} className={className || undefined}>
        {part.text}
      </span>
    );
  });
}

function commentLineClass(
  lineNumber: number,
  commentLines?: Set<number>,
  activeCommentLine?: number | null,
): string | undefined {
  if (activeCommentLine === lineNumber) return "highlight-line--comment-active";
  if (commentLines?.has(lineNumber)) return "highlight-line--comment";
  return undefined;
}

export function HighlightingTextarea({
  value,
  baseline,
  highlight = false,
  showTextHighlights = true,
  commentLines,
  activeCommentLine = null,
  fillContainer = true,
  className,
  mirrorClassName,
  inputRef,
  onScroll,
  ...props
}: TextareaProps & {
  baseline: string;
  highlight?: boolean;
  showTextHighlights?: boolean;
  commentLines?: Set<number>;
  activeCommentLine?: number | null;
  /** When false, textarea grows with content; parent should scroll. */
  fillContainer?: boolean;
  mirrorClassName?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const mirrorRef = useRef<HTMLPreElement>(null);

  const text = typeof value === "string" ? value : String(value ?? "");
  const debouncedText = useDebouncedValue(text, 120);
  const showPendingMirror = highlight && debouncedText !== baseline;
  const lines = useMemo(() => splitLines(text), [text]);
  const showHlMirror = showTextHighlights && hasRawTextHighlights(text);
  const showCommentMirror = Boolean(commentLines && commentLines.size > 0);
  const showMirror = showPendingMirror || showHlMirror || showCommentMirror;

  const rows = useMemo((): HighlightRow[] => {
    if (!showPendingMirror) {
      return lines.map((line) => ({ kind: "equal" as const, text: line }));
    }
    const computed = pendingCurrentLineHighlightRows(baseline, debouncedText);
    if (computed.length !== lines.length) {
      return lines.map((line) => ({ kind: "equal" as const, text: line }));
    }
    return computed;
  }, [baseline, debouncedText, lines, showPendingMirror]);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }, [textareaRef]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLTextAreaElement>) => {
      syncScroll();
      onScroll?.(event);
    },
    [onScroll, syncScroll],
  );

  const mirror = showMirror ? (
    <pre
      ref={mirrorRef}
      className={cn(
        "highlighting-textarea__mirror pointer-events-none m-0 whitespace-pre-wrap break-words border-0 bg-transparent",
        fillContainer
          ? "absolute inset-0 z-0 overflow-hidden"
          : "highlighting-textarea__mirror--grow z-0",
        className,
        mirrorClassName,
      )}
      aria-hidden="true"
    >
      {lines.map((line, index) => {
        const row = rows[index] ?? { kind: "equal" as const, text: line };
        const prefix = index > 0 ? "\n" : "";
        const parts = lineMirrorParts(line, row);
        const lineClass = commentLineClass(index + 1, commentLines, activeCommentLine);

        return (
          <Fragment key={index}>
            {prefix}
            <span className={lineClass}>
              {renderMirrorParts(parts, String(index))}
            </span>
          </Fragment>
        );
      })}
    </pre>
  ) : null;

  return (
    <div
      className={cn(
        "highlighting-textarea",
        fillContainer
          ? "relative flex min-h-0 min-w-0 w-full flex-1 flex-col"
          : "highlighting-textarea--grow w-full min-w-0",
      )}
    >
      {mirror}
      <textarea
        ref={textareaRef}
        {...props}
        value={text}
        className={cn(
          "highlighting-textarea__input box-border w-full min-w-0 max-w-full resize-none border-0 bg-transparent outline-none focus:ring-0 focus-visible:outline-none",
          fillContainer
            ? "relative z-[1] min-h-0 flex-1 overflow-auto"
            : "highlighting-textarea__input--grow z-[1] overflow-hidden",
          showMirror && "highlighting-textarea__input--overlay",
          className,
        )}
        onScroll={fillContainer ? handleScroll : undefined}
      />
    </div>
  );
}
