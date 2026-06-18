import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileCode2 } from "lucide-react";

import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { PendingChangesPanel } from "@/components/editor/PendingChangesPanel";
import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import { Button } from "@/components/ui/button";
import { draftSaveMeta, draftStatusLabel } from "@/lib/draftApproval";
import { useDraftAutosave } from "@/lib/useDraftAutosave";
import { cn } from "@/lib/utils";
import { fetchApprovedSectionCompose, syncSectionDraft } from "@/modelApi";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

type PaneEditMode = "rendered" | "raw";

function buildDraftMarkdown(title: string, body: string): string {
  return title.trim() ? `# ${title.trim()}\n\n${body.trimEnd()}\n` : `${body.trimEnd()}\n`;
}

function stripComposedTitle(title: string, markdown: string): string {
  return markdown.replace(/^#\s+.+\n+/, "");
}

export function ComposedDraftEditor({
  containerPath,
  title,
  markdown,
  refreshVersion,
  linkContextPath,
  onNavigate,
  onError,
  onSynced,
  paneLabel = "Draft",
  subtitle,
  headerExtra,
  className,
}: {
  containerPath: string;
  title: string;
  markdown: string;
  refreshVersion: number;
  linkContextPath: string;
  onNavigate: (target: NavigateTarget) => void;
  onError: (message: string) => void;
  onSynced?: () => void;
  paneLabel?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  className?: string;
}) {
  const [content, setContent] = useState(markdown);
  const [loadedContent, setLoadedContent] = useState(markdown);
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [paneMode, setPaneMode] = useState<PaneEditMode>("rendered");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirtyRef = useRef(false);

  const saveContent = useCallback(
    async (body: string, pendingSource: "human" | "ai" | null) => {
      await syncSectionDraft(
        containerPath,
        buildDraftMarkdown(title, body),
        draftSaveMeta(pendingSource),
      );
    },
    [containerPath, title],
  );

  const reloadAfterDiscard = useCallback(async () => {
    const { draftMarkdown } = await fetchApprovedSectionCompose(containerPath);
    return stripComposedTitle(title, draftMarkdown);
  }, [containerPath, title]);

  const {
    saveState,
    isDirty,
    isPendingApproval,
    pendingSource,
    githubHandle,
    handleApprove,
    handleDiscard,
  } = useDraftAutosave({
    targetPath: containerPath,
    content,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard,
    onError,
    onSaved: onSynced,
    onDiscarded: (restored) => setContent(restored),
  });

  isDirtyRef.current = isDirty;
  const lineCount = useMemo(() => Math.max(24, content.split("\n").length + 2), [content]);

  useEffect(() => {
    let cancelled = false;
    void fetchApprovedSectionCompose(containerPath)
      .then(({ draftMarkdown }) => {
        if (!cancelled) {
          setApprovedBaseline(stripComposedTitle(title, draftMarkdown));
        }
      })
      .catch(() => {
        if (!cancelled) setApprovedBaseline("");
      });
    return () => {
      cancelled = true;
    };
  }, [containerPath, refreshVersion, title]);

  useEffect(() => {
    if (isDirtyRef.current) return;
    setContent(markdown);
    setLoadedContent(markdown);
  }, [markdown, refreshVersion]);

  const handleHeadingNavigate = useCallback(
    (href: string) => {
      const target = resolveNavigateTarget(linkContextPath, href);
      if (target) onNavigate(target);
    },
    [linkContextPath, onNavigate],
  );

  const handleRawClick = useCallback(
    (event: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const textarea = event.currentTarget;
      const lineIndex = textarea.value.slice(0, textarea.selectionStart).split("\n").length - 1;
      const line = textarea.value.split("\n")[lineIndex] ?? "";
      const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!match) return;
      event.preventDefault();
      handleHeadingNavigate(match[2]);
    },
    [handleHeadingNavigate],
  );

  const saveLabel = draftStatusLabel({
    requiresApproval: true,
    isPendingApproval,
    isDirty,
    saveState,
    defaultLabel: "approved",
  });

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <DraftApprovalBar
        pendingSource={isPendingApproval ? pendingSource : null}
        editedBy={githubHandle}
        aiAssisted={pendingSource === "ai"}
        onApprove={() => void handleApprove()}
        onDiscard={() => void handleDiscard()}
        approving={saveState === "saving"}
        approveLabel="Approve & sync sections"
      />
      {isPendingApproval ? (
        <PendingChangesPanel baseline={approvedBaseline} current={content} />
      ) : null}
      <div className="ui-pane-header shrink-0">
        <div className="flex min-w-0 flex-col">
          <span className="ui-label">{paneLabel}</span>
          {subtitle ? (
            <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-ui-2xs text-muted-foreground">{saveLabel}</span>
          {headerExtra}
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="group"
            aria-label={`${paneLabel} editing mode`}
          >
            <Button
              type="button"
              variant={paneMode === "rendered" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              aria-pressed={paneMode === "rendered"}
              title="Preview + edit — live formatted view above source"
              onClick={() => setPaneMode("rendered")}
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              Preview
            </Button>
            <Button
              type="button"
              variant={paneMode === "raw" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              aria-pressed={paneMode === "raw"}
              title="Raw markdown with section links"
              onClick={() => setPaneMode("raw")}
            >
              <FileCode2 className="h-3 w-3" aria-hidden="true" />
              Raw
            </Button>
          </div>
        </div>
      </div>

      <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
        {content.trim() || paneMode === "raw" ? (
          paneMode === "rendered" ? (
            <RenderedMarkdownField
              value={content}
              onChange={setContent}
              approvedBaseline={approvedBaseline}
              highlightPending={isPendingApproval}
              linkContextPath={linkContextPath}
              linksClickable
              onNavigate={onNavigate}
              inputRef={textareaRef}
              ariaLabel={`Edit composed ${paneLabel.toLowerCase()}`}
              placeholder="Full composed draft — edits autosave to section drafts; approve when ready for export…"
            />
          ) : (
            <HighlightingTextarea
              inputRef={textareaRef}
              className="composed-draft-raw w-full font-mono text-[13px] leading-6"
              mirrorClassName="font-mono text-[13px] leading-6"
              value={content}
              baseline={approvedBaseline}
              highlight={isPendingApproval}
              rows={lineCount}
              spellCheck={false}
              aria-label={`Edit composed ${paneLabel.toLowerCase()} (raw)`}
              onChange={(event) => setContent(event.target.value)}
              onClick={handleRawClick}
            />
          )
        ) : (
          <p className="text-sm italic text-muted-foreground">Empty composed draft.</p>
        )}
      </div>
    </div>
  );
}
