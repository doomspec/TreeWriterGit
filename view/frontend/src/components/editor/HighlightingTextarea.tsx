import { useCallback, useMemo, useRef } from "react";

import { pendingLineHighlightRows, splitLines } from "@/lib/draftDiff";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function HighlightingTextarea({
  value,
  baseline,
  highlight = false,
  fillContainer = true,
  className,
  mirrorClassName,
  inputRef,
  onScroll,
  ...props
}: TextareaProps & {
  baseline: string;
  highlight?: boolean;
  /** When false, textarea grows with content; parent should scroll. */
  fillContainer?: boolean;
  mirrorClassName?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localRef;
  const mirrorRef = useRef<HTMLPreElement>(null);

  const text = typeof value === "string" ? value : String(value ?? "");
  const showHighlight = highlight && text !== baseline;
  const lines = useMemo(() => splitLines(text), [text]);
  const rows = useMemo(
    () => (showHighlight ? pendingLineHighlightRows(baseline, text) : lines.map((line) => ({ kind: "equal" as const, text: line }))),
    [baseline, lines, showHighlight, text],
  );

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

  const mirror = showHighlight ? (
    <pre
      ref={mirrorRef}
      className={cn(
        "highlighting-textarea__mirror pointer-events-none m-0 whitespace-pre-wrap break-words border-0 bg-transparent",
        fillContainer
          ? "absolute inset-0 z-0 overflow-hidden"
          : "highlighting-textarea__mirror--grow z-0",
        mirrorClassName,
      )}
      aria-hidden="true"
    >
      {lines.map((line, index) => {
        const row = rows[index] ?? { kind: "equal" as const, text: line };
        const display = line.length > 0 ? line : "\u00a0";

        if (row.kind === "inline") {
          return (
            <div key={index} className="highlight-line">
              {row.segments.map((segment, segmentIndex) =>
                segment.text ? (
                  <span
                    key={segmentIndex}
                    className={segment.kind === "insert" ? "highlight-inline--pending" : undefined}
                  >
                    {segment.text}
                  </span>
                ) : null,
              )}
            </div>
          );
        }

        return (
          <div
            key={index}
            className={cn(
              "highlight-line",
              row.kind === "full" && "highlight-line--pending",
            )}
          >
            {display}
          </div>
        );
      })}
    </pre>
  ) : null;

  return (
    <div
      className={cn(
        "highlighting-textarea",
        fillContainer ? "relative min-h-0 flex-1" : "highlighting-textarea--grow w-full",
      )}
    >
      {mirror}
      <textarea
        ref={textareaRef}
        {...props}
        value={text}
        className={cn(
          "highlighting-textarea__input w-full resize-none border-0 bg-transparent outline-none focus:ring-0 focus-visible:outline-none",
          fillContainer
            ? "relative z-[1] min-h-0 flex-1 overflow-auto"
            : "highlighting-textarea__input--grow z-[1] overflow-hidden",
          showHighlight && "highlighting-textarea__input--overlay",
          className,
        )}
        onScroll={fillContainer ? handleScroll : undefined}
      />
    </div>
  );
}
