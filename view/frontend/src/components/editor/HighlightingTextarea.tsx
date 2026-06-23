import { Fragment, useCallback, useMemo, useRef } from "react";

import { pendingCurrentLineHighlightRows, splitLines } from "@/lib/draftDiff";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
  const debouncedText = useDebouncedValue(text, 120);
  const showHighlight = highlight && debouncedText !== baseline;
  const lines = useMemo(() => splitLines(text), [text]);
  const rows = useMemo(() => {
    if (!showHighlight) {
      return lines.map((line) => ({ kind: "equal" as const, text: line }));
    }
    const computed = pendingCurrentLineHighlightRows(baseline, debouncedText);
    if (computed.length !== lines.length) {
      return lines.map((line) => ({ kind: "equal" as const, text: line }));
    }
    return computed;
  }, [baseline, debouncedText, lines, showHighlight]);

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
        className,
        mirrorClassName,
      )}
      aria-hidden="true"
    >
      {lines.map((line, index) => {
        const row = rows[index] ?? { kind: "equal" as const, text: line };
        const prefix = index > 0 ? "\n" : "";
        const display = line.length > 0 ? line : "\u00a0";

        if (row.kind === "inline") {
          return (
            <Fragment key={index}>
              {prefix}
              {row.segments.map((segment, segmentIndex) =>
                segment.text ? (
                  <span
                    key={segmentIndex}
                    className={
                      segment.kind === "insert"
                        ? "highlight-inline--pending"
                        : segment.kind === "delete"
                          ? "highlight-inline--deleted"
                          : undefined
                    }
                  >
                    {segment.text}
                  </span>
                ) : null,
              )}
            </Fragment>
          );
        }

        return (
          <Fragment key={index}>
            {prefix}
            <span className={row.kind === "full" ? "highlight-line--pending" : undefined}>{display}</span>
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
          showHighlight && "highlighting-textarea__input--overlay",
          className,
        )}
        onScroll={fillContainer ? handleScroll : undefined}
      />
    </div>
  );
}
