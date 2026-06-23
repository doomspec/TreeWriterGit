import { useEffect, useState } from "react";
import { Network, PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReadingFocusInlineGraph, useReadingFocusGraph } from "@/lib/readingFocusGraph";
import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

function FocusProseColumn({
  title,
  children,
  graphGutter,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  graphGutter?: React.ReactNode;
}) {
  return (
    <div className="reading-focus-document__prose-column">
      {title ? <div className="reading-focus-document__title">{title}</div> : null}
      <div className="reading-focus-document__content-row">
        {graphGutter}
        <div className="reading-focus-document__body">{children}</div>
      </div>
    </div>
  );
}

export function ReadingFocusDocumentLayout({
  title,
  children,
  stackClassName,
  showGraph = true,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  stackClassName?: string;
  /** When false, omit the inline link graph (e.g. draft pane in Both view). */
  showGraph?: boolean;
}) {
  const { active } = useReadingFocus();
  const graph = useReadingFocusGraph();
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    if (active) setGraphOpen(false);
  }, [active]);

  if (!active || !graph?.fetchRoot) {
    return (
      <div className={cn(title ? cn("flex flex-col gap-4", stackClassName) : stackClassName)}>
        {title}
        {children}
      </div>
    );
  }

  const graphGutter =
    showGraph && graphOpen ? (
      <aside className="reading-focus-graph-gutter" aria-label="Link graph">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="reading-focus-graph-toggle h-7 w-7"
          title="Hide graph"
          aria-label="Hide graph"
          onClick={() => setGraphOpen(false)}
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <ReadingFocusInlineGraph />
      </aside>
    ) : showGraph ? (
      <div className="reading-focus-graph-gutter reading-focus-graph-gutter--reveal">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="reading-focus-graph-reveal"
          title="Show graph"
          aria-label="Show graph"
          onClick={() => setGraphOpen(true)}
        >
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "reading-focus-document",
        showGraph && !graphOpen && "reading-focus-document--graph-collapsed",
        !showGraph && "reading-focus-document--no-graph",
      )}
    >
      <FocusProseColumn title={title} graphGutter={graphGutter}>
        {children}
      </FocusProseColumn>
    </div>
  );
}
