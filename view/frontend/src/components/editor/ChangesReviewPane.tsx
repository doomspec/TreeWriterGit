import { useMemo } from "react";

import { PendingChangesDiff, usePendingChangesSummary } from "@/components/editor/PendingChangesDiff";
import { markdownToEditableHtml } from "@/lib/markdownRoundtrip";
import { markdownWithPendingHighlights } from "@/lib/pendingHighlightMarkdown";
import { cn } from "@/lib/utils";

export function ChangesReviewPane({
  approvedBaseline,
  loadedContent,
  current,
  renderedMarkdown,
  renderedApprovedBaseline,
  renderedLoadedContent,
  className,
}: {
  approvedBaseline: string;
  loadedContent: string;
  current: string;
  renderedMarkdown?: string;
  renderedApprovedBaseline?: string;
  renderedLoadedContent?: string;
  className?: string;
}) {
  const { summary, hasChanges } = usePendingChangesSummary(approvedBaseline, loadedContent, current);
  const displayMarkdown = renderedMarkdown ?? current;
  const displayApproved = renderedApprovedBaseline ?? approvedBaseline;
  const displayLoaded = renderedLoadedContent ?? loadedContent;

  const renderedHtml = useMemo(() => {
    const highlighted =
      markdownWithPendingHighlights(displayApproved, displayLoaded, displayMarkdown) ??
      displayMarkdown;
    return markdownToEditableHtml(highlighted);
  }, [displayApproved, displayLoaded, displayMarkdown]);

  return (
    <div className={cn("changes-review-pane", className)}>
      <p className="changes-review-pane__summary">{summary}</p>

      {hasChanges ? (
        <>
          <PendingChangesDiff
            approvedBaseline={approvedBaseline}
            loadedContent={loadedContent}
            current={current}
            comfortable
            className="changes-review-pane__diff"
          />
          {displayMarkdown.trim() ? (
            <div
              className="markdown-body changes-review-pane__document"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No unapproved changes.</p>
      )}
    </div>
  );
}
