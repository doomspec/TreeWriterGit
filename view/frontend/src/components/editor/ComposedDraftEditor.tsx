import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileCode2 } from "lucide-react";

import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { PendingChangesPanel } from "@/components/editor/PendingChangesPanel";
import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import { Button } from "@/components/ui/button";
import {
  approveDraftAtPath,
  discardDraftAtPath,
  draftSaveMeta,
  draftStatusLabel,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import { getGitHubHandle } from "@/lib/userIdentity";
import { useRegisterDraftPending } from "@/lib/draftPendingStore";
import { cn } from "@/lib/utils";
import { fetchApprovedSectionCompose, syncSectionDraft } from "@/modelApi";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingSource, setPendingSource] = useState<DraftPendingSource | null>(null);
  const [paneMode, setPaneMode] = useState<PaneEditMode>("rendered");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirtyRef = useRef(false);
  const isDirty = content !== loadedContent;
  const isPendingApproval = content !== approvedBaseline;
  useRegisterDraftPending(containerPath, isPendingApproval);
  isDirtyRef.current = isDirty;
  const githubHandle = getGitHubHandle();
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
    setSaveState("idle");
  }, [markdown, refreshVersion]);

  useEffect(() => {
    if (isPendingApproval) {
      setPendingSource("human");
    } else {
      setPendingSource(null);
    }
  }, [isPendingApproval]);

  useEffect(() => {
    if (!isDirty) return;
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const draftMarkdown = buildDraftMarkdown(title, content);
      try {
        await syncSectionDraft(containerPath, draftMarkdown, draftSaveMeta(pendingSource));
        setLoadedContent(content);
        setSaveState("saved");
        onSynced?.();
        window.setTimeout(() => setSaveState("idle"), 900);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveState("error");
        onError(message);
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [containerPath, content, isDirty, onError, onSynced, pendingSource, title]);

  const handleApprove = useCallback(async () => {
    setSaveState("saving");
    const draftMarkdown = buildDraftMarkdown(title, content);
    try {
      if (isDirty) await syncSectionDraft(containerPath, draftMarkdown, draftSaveMeta(pendingSource));
      await approveDraftAtPath(containerPath, githubHandle || null);
      setLoadedContent(content);
      setApprovedBaseline(content);
      setPendingSource(null);
      setSaveState("saved");
      onSynced?.();
      window.setTimeout(() => setSaveState("idle"), 900);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      onError(message);
    }
  }, [containerPath, content, githubHandle, isDirty, onError, onSynced, pendingSource, title]);

  const handleDiscard = useCallback(async () => {
    setSaveState("saving");
    try {
      await discardDraftAtPath(containerPath);
      const { draftMarkdown } = await fetchApprovedSectionCompose(containerPath);
      const restored = stripComposedTitle(title, draftMarkdown);
      setContent(restored);
      setLoadedContent(restored);
      setApprovedBaseline(restored);
      setPendingSource(null);
      setSaveState("idle");
      onSynced?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      onError(message);
    }
  }, [containerPath, onError, onSynced, title]);

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
              aria-label={`Edit raw composed ${paneLabel.toLowerCase()}`}
              onChange={(event) => setContent(event.target.value)}
              onClick={handleRawClick}
            />
          )
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No draft content yet — start writing here; changes autosave to child section drafts.
          </p>
        )}
      </div>
    </div>
  );
}
