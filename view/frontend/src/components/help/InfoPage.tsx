import { ArrowLeft, FileStack } from "lucide-react";

import { InfoGuideContent } from "@/components/help/InfoGuideContent";
import { Button } from "@/components/ui/button";
import { WorkspaceStatusPanel } from "@/components/workspace/WorkspaceStatusPanel";
import type { CommentRecord, CommentSummary } from "@treewriter/shared";
import type { GitSyncState } from "@/lib/gitSync";

export function InfoPage({
  onBack,
  onOpenInPapers,
  filesCount,
  commentSummary,
  assignedComments = [],
  paperSlug,
  gitSync,
  viewSyncPaused,
  onResolveViewSync,
}: {
  onBack: () => void;
  onOpenInPapers?: () => void;
  filesCount: number;
  commentSummary: CommentSummary | null;
  assignedComments?: CommentRecord[];
  paperSlug?: string | null;
  gitSync: GitSyncState | null;
  viewSyncPaused: boolean;
  onResolveViewSync: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div className="shrink-0 border-b border-border bg-card/80 px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 sm:gap-3">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to workspace
          </Button>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Features, Overleaf sync, command palette, and keyboard shortcuts
          </p>
          {onOpenInPapers ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={onOpenInPapers}
            >
              <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
              Open in Papers
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <WorkspaceStatusPanel
            filesCount={filesCount}
            commentSummary={commentSummary}
            assignedComments={assignedComments}
            paperSlug={paperSlug}
            gitSync={gitSync}
            viewSyncPaused={viewSyncPaused}
            onResolveViewSync={onResolveViewSync}
          />
          <InfoGuideContent />
        </div>
      </div>
    </div>
  );
}
