import { useMemo } from "react";
import katex from "katex";

import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";

export function EquationBlock({
  source,
  displayMode = true,
  className,
}: {
  source: string;
  displayMode?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    const trimmed = source.trim();
    if (!trimmed) return null;
    try {
      return katex.renderToString(trimmed, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return null;
    }
  }, [displayMode, source]);

  if (!source.trim()) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        No equation source yet
      </div>
    );
  }

  if (!html) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed",
          className,
        )}
      >
        {source}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "equation-block overflow-x-auto rounded-md border border-border bg-background px-4 py-3 text-center",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
