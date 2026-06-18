import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileCode2 } from "lucide-react";

import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { PendingChangesPanel } from "@/components/editor/PendingChangesPanel";
import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import {
  dispatchActionForUnitPane,
  dispatchActionLabel,
  isDispatchRunShortcut,
  unitPathFromUnitFile,
} from "@/lib/agentDispatchClient";
import { useDispatchJob } from "@/lib/useDispatchJob";
import { authorNoteMacro, wrapInlineNote } from "@/lib/inlineNotes";
import { cn } from "@/lib/utils";
import { getGitHubHandle, getUserName } from "@/lib/userIdentity";
import { parseFrontmatterStatus, parentPath, stripFrontmatter, type NavigateTarget } from "@/lib/modelTree";
import {
  draftSaveMeta,
  draftStatusLabel,
  loadDraftApprovalState,
  loadModelFileContent,
  requiresDraftApproval,
  type DraftEditMeta,
  type DraftPendingSource,
} from "@/lib/draftApproval";
import { useDraftAutosave, type SaveState } from "@/lib/useDraftAutosave";
import {
  ApiError,
  claimPresence,
  fetchComments,
  fetchPresence,
  heartbeatPresence,
  releasePresence,
  saveModelFile,
} from "@/modelApi";

export type EditorLayout = "split" | "source" | "preview";
export type PaneEditMode = "rendered" | "raw";

function parsePreviewBody(markdown: string) {
  const withoutFrontmatter = stripFrontmatter(markdown);
  const headingMatch = withoutFrontmatter.match(/^\s*#(?!#)\s+(.+?)\s*(?:\r?\n|$)/);
  if (!headingMatch) {
    return { title: null, body: withoutFrontmatter };
  }
  return {
    title: headingMatch[1],
    body: withoutFrontmatter.slice(headingMatch[0].length),
  };
}

function splitForPreviewEdit(full: string) {
  const fmMatch = full.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) {
    return { frontmatter: "", body: full, suffix: "" };
  }
  const frontmatter = fmMatch[0];
  const rest = full.slice(frontmatter.length);
  return { frontmatter, body: rest, suffix: "" };
}

function mergePreviewEdit(frontmatter: string, body: string): string {
  return frontmatter ? `${frontmatter}${body}` : body;
}

function handleFormatShortcut(event: React.KeyboardEvent, onFormat: (action: MarkdownFormatAction) => void): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  const key = event.key.toLowerCase();
  if (key === "b") {
    event.preventDefault();
    onFormat("bold");
    return true;
  }
  if (key === "i") {
    event.preventDefault();
    onFormat("italic");
    return true;
  }
  return false;
}

export function MarkdownEditor({
  filePath,
  refreshVersion,
  layout,
  compact = false,
  paneLabel,
  defaultPaneMode = "rendered",
  onSaveStateChange,
  onContentChange,
  onError,
  className,
  linkContextPath = "",
  onNavigate,
  onSendToTerminal,
  onBeforeDispatch,
  onDispatchComplete,
  splitPercent = 50,
  onSplitChange,
  isFigureUnit = false,
  paperPath = null,
}: {
  filePath: string;
  refreshVersion: number;
  layout: EditorLayout;
  compact?: boolean;
  paneLabel?: string;
  defaultPaneMode?: PaneEditMode;
  onSaveStateChange?: (state: SaveState) => void;
  onContentChange?: (content: string) => void;
  onError?: (message: string) => void;
  className?: string;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  onSendToTerminal?: (command: string) => void;
  onBeforeDispatch?: () => void;
  onDispatchComplete?: () => void;
  splitPercent?: number;
  onSplitChange?: (percent: number) => void;
  isFigureUnit?: boolean;
  /** Paper root for asset insert picker, e.g. `papers/roboculture`. */
  paperPath?: string | null;
}) {
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paneMode, setPaneMode] = useState<PaneEditMode>(defaultPaneMode);
  const [previewRawEdit, setPreviewRawEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const [selectedLine, setSelectedLine] = useState(1);
  const [otherEditor, setOtherEditor] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState<DraftEditMeta>({
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    approvedBy: null,
    approvedAt: null,
  });
  const dispatchSnapshotRef = useRef<string | null>(null);
  const requiresApproval = useMemo(() => requiresDraftApproval(filePath), [filePath]);

  const saveContent = useCallback(
    async (nextContent: string, pendingSource: DraftPendingSource | null) => {
      await saveModelFile(filePath, nextContent, draftSaveMeta(pendingSource));
      if (requiresApproval) {
        const handle = getGitHubHandle();
        setEditMeta((prev) => ({
          ...prev,
          editedBy: handle || prev.editedBy,
          editedAt: new Date().toISOString(),
          aiAssisted: pendingSource === "ai" || prev.aiAssisted,
        }));
      }
    },
    [filePath, requiresApproval],
  );

  const {
    saveState,
    setSaveState,
    isDirty,
    isPendingApproval,
    pendingSource,
    setPendingSource,
    githubHandle,
    flushSave,
    handleApprove: handleApproveDraft,
    handleDiscard: handleDiscardDraft,
  } = useDraftAutosave({
    targetPath: filePath,
    content,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard: () => loadModelFileContent(filePath),
    onError: (message) => {
      setLoadError(message);
      onError?.(message);
    },
    onApproved: async () => {
      const { meta } = await loadDraftApprovalState(filePath);
      setEditMeta(meta);
      dispatchSnapshotRef.current = null;
      setLoadError(null);
    },
    onDiscarded: (restored) => {
      setContent(restored);
      void loadDraftApprovalState(filePath).then(({ meta }) => setEditMeta(meta));
      dispatchSnapshotRef.current = null;
      setLoadError(null);
    },
    requiresApproval,
  });

  const dispatchPane = paneLabel === "Outline" ? "outline" : paneLabel === "Draft" ? "draft" : undefined;
  const authorName = useMemo(() => getUserName(), []);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const previewParts = useMemo(() => splitForPreviewEdit(content), [content]);
  const previewMeta = useMemo(() => parsePreviewBody(content), [content]);
  const previewBody = previewMeta.title ? previewMeta.body : previewParts.body;
  const approvedPreviewMeta = useMemo(() => parsePreviewBody(approvedBaseline), [approvedBaseline]);
  const approvedPreviewParts = useMemo(() => splitForPreviewEdit(approvedBaseline), [approvedBaseline]);
  const approvedPreviewBody = approvedPreviewMeta.title
    ? approvedPreviewMeta.body
    : approvedPreviewParts.body;
  const unitStatus = useMemo(() => parseFrontmatterStatus(content), [content]);
  const unitPath = useMemo(() => unitPathFromUnitFile(filePath), [filePath]);
  const dispatchAction = useMemo(
    () =>
      dispatchActionForUnitPane(
        paneLabel,
        Boolean(previewBody.trim() || content.trim()),
        isFigureUnit,
      ),
    [content, isFigureUnit, paneLabel, previewBody],
  );
  const canDispatch = Boolean(compact && unitPath && dispatchAction);
  const { progress: dispatchProgress, dispatching, runUnitDispatch } = useDispatchJob({
    scope: "unit",
    targetPath: unitPath,
    pane: dispatchPane,
    onResumeComplete: onDispatchComplete,
    onError,
  });

  const statusText = draftStatusLabel({
    requiresApproval,
    isPendingApproval,
    isDirty,
    saveState,
    defaultLabel: saveState,
  });

  const handleDispatch = useCallback(async () => {
    if (!canDispatch || !unitPath || !dispatchAction) return;
    try {
      if (requiresApproval) {
        dispatchSnapshotRef.current = approvedBaseline;
      }
      await flushSave();
      onBeforeDispatch?.();
      await runUnitDispatch({
        unitPath,
        action: dispatchAction,
      });
      onDispatchComplete?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [
    approvedBaseline,
    canDispatch,
    dispatchAction,
    flushSave,
    onBeforeDispatch,
    onDispatchComplete,
    onError,
    requiresApproval,
    runUnitDispatch,
    unitPath,
  ]);

  useEffect(() => {
    setPreviewRawEdit(false);
    setPaneMode(defaultPaneMode);
    setPendingSource(null);
    dispatchSnapshotRef.current = null;
  }, [defaultPaneMode, filePath]);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    onContentChange?.(content);
  }, [content, onContentChange]);

  useEffect(() => {
    let cancelled = false;
    fetchComments(filePath)
      .then(({ comments }) => {
        if (!cancelled) {
          setUnresolvedComments(comments.filter((c) => !c.resolved).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filePath, refreshVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!requiresApproval) {
      setApprovedBaseline("");
      return () => {
        cancelled = true;
      };
    }
    void loadDraftApprovalState(filePath).then(({ content: baseline, meta }) => {
      if (!cancelled) {
        setApprovedBaseline(baseline);
        setEditMeta(meta);
        if (meta.aiAssisted && baseline) {
          setPendingSource((prev) => (prev === "human" ? prev : "ai"));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filePath, refreshVersion, requiresApproval]);

  useEffect(() => {
    let cancelled = false;
    if (isDirtyRef.current) {
      return () => {
        cancelled = true;
      };
    }

    void loadModelFileContent(filePath)
      .then(async (diskContent) => {
        if (cancelled) return;
        const snapshot = dispatchSnapshotRef.current;
        dispatchSnapshotRef.current = null;
        setContent(diskContent);
        setLoadedContent(diskContent);
        if (requiresApproval && snapshot !== null && diskContent !== snapshot) {
          setPendingSource("ai");
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) setEditMeta(meta);
          });
        } else if (!requiresApproval || diskContent === approvedBaseline) {
          setPendingSource(null);
        }
        setSaveState("idle");
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message);
          setSaveState("error");
          onError?.(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, onError, refreshVersion, requiresApproval, setPendingSource, setSaveState]);

  useEffect(() => {
    let cancelled = false;
    let heartbeatTimer: number | undefined;

    const syncPresence = async () => {
      try {
        const { presence } = await fetchPresence(filePath);
        if (cancelled) return;
        if (presence && presence.user !== authorName) {
          setOtherEditor(presence.user);
          return;
        }
        try {
          await claimPresence(filePath, authorName);
          if (!cancelled) setOtherEditor(null);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            const retry = await fetchPresence(filePath);
            if (!cancelled && retry.presence) setOtherEditor(retry.presence.user);
          }
        }
      } catch {
        // presence is best-effort on localhost
      }
    };

    void syncPresence();
    heartbeatTimer = window.setInterval(() => {
      void heartbeatPresence(filePath, authorName);
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      void releasePresence(filePath, authorName);
    };
  }, [authorName, filePath]);

  const updateSelectedLine = () => {
    const el = sourceRef.current ?? previewRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    setSelectedLine(before.split("\n").length);
  };

  const effectiveLayout = compact ? (paneMode === "raw" ? "source" : "preview") : layout;
  const showSource = effectiveLayout === "source" || effectiveLayout === "split";
  const showPreview = effectiveLayout === "preview" || effectiveLayout === "split";
  const renderedEditable = compact ? paneMode === "rendered" : previewRawEdit;

  const handlePreviewBodyChange = useCallback(
    (body: string) => {
      const withHeading = previewMeta.title
        ? `# ${previewMeta.title}\n\n${body.replace(/^\s+/, "")}`
        : body;
      setContent(mergePreviewEdit(previewParts.frontmatter, withHeading));
    },
    [previewMeta.title, previewParts.frontmatter],
  );

  const insertInlineNote = useCallback(
    (targetPane?: "preview" | "source") => {
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      let usePreview: boolean;
      if (targetPane === "preview") {
        usePreview = true;
      } else if (targetPane === "source") {
        usePreview = false;
      } else {
        usePreview = Boolean(
          previewEl &&
            renderedEditable &&
            (document.activeElement === previewEl || (showPreview && !showSource)),
        );
      }
      const target = usePreview && previewEl ? previewEl : sourceEl;
      if (!target) return;
      const currentValue = usePreview ? previewBody : content;
      const setValue = usePreview ? handlePreviewBodyChange : setContent;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const selected = currentValue.slice(start, end);
      const note = wrapInlineNote(authorNoteMacro(getUserName()), selected);
      insertIntoTarget(target, currentValue, setValue, `${currentValue.slice(0, start)}${note}${currentValue.slice(end)}`, start + note.length);
    },
    [content, handlePreviewBodyChange, previewBody, renderedEditable, showPreview, showSource],
  );

  const insertIntoTarget = (
    target: HTMLTextAreaElement,
    _currentValue: string,
    setValue: (value: string) => void,
    nextValue: string,
    cursor: number,
  ) => {
    setValue(nextValue);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(cursor, cursor);
      updateSelectedLine();
    });
  };

  const insertSnippet = useCallback(
    (snippet: string, targetPane?: "preview" | "source") => {
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      let usePreview: boolean;
      if (targetPane === "preview") {
        usePreview = true;
      } else if (targetPane === "source") {
        usePreview = false;
      } else {
        usePreview = Boolean(
          previewEl &&
            renderedEditable &&
            (document.activeElement === previewEl || (showPreview && !showSource)),
        );
      }
      const target = usePreview && previewEl ? previewEl : sourceEl;
      if (!target) return;
      const currentValue = usePreview ? previewBody : content;
      const setValue = usePreview ? handlePreviewBodyChange : setContent;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextValue = `${currentValue.slice(0, start)}${snippet}${currentValue.slice(end)}`;
      insertIntoTarget(target, currentValue, setValue, nextValue, start + snippet.length);
    },
    [content, handlePreviewBodyChange, previewBody, renderedEditable, showPreview, showSource],
  );

  const applyFormat = useCallback(
    (action: MarkdownFormatAction, targetPane?: "preview" | "source") => {
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;

      let usePreview: boolean;
      if (targetPane === "preview") {
        usePreview = true;
      } else if (targetPane === "source") {
        usePreview = false;
      } else {
        usePreview = Boolean(
          previewEl &&
            renderedEditable &&
            (document.activeElement === previewEl || (showPreview && !showSource)),
        );
      }

      const target = usePreview && previewEl ? previewEl : sourceEl;
      if (!target) return;

      const currentValue = usePreview ? previewBody : content;
      const setValue = usePreview ? handlePreviewBodyChange : setContent;

      const result = applyMarkdownFormat(
        currentValue,
        target.selectionStart,
        target.selectionEnd,
        action,
      );
      setValue(result.value);
      requestAnimationFrame(() => {
        target.focus();
        target.setSelectionRange(result.selectionStart, result.selectionEnd);
        updateSelectedLine();
      });
    },
    [content, handlePreviewBodyChange, previewBody, renderedEditable, showPreview, showSource],
  );

  const onTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (canDispatch && isDispatchRunShortcut(event)) {
        event.preventDefault();
        void handleDispatch();
        return;
      }
      handleFormatShortcut(event, (action) => applyFormat(action));
    },
    [applyFormat, canDispatch, handleDispatch],
  );

  const modeToggle = compact ? (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="group"
      aria-label={`${paneLabel ?? "Document"} editing mode`}
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
        title="Raw markdown"
        onClick={() => setPaneMode("raw")}
      >
        <FileCode2 className="h-3 w-3" aria-hidden="true" />
        Raw
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      variant={previewRawEdit ? "default" : "ghost"}
      size="icon"
      className="h-6 w-6"
      title={previewRawEdit ? "Show rendered preview" : "Edit in rendered style"}
      aria-label={previewRawEdit ? "Show rendered preview" : "Edit in rendered style"}
      aria-pressed={previewRawEdit}
      onClick={() => setPreviewRawEdit((v) => !v)}
    >
      {previewRawEdit ? (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );

  const compactTargetPane: "preview" | "source" = renderedEditable ? "preview" : "source";

  const toolbarProps = {
    renderedMode: renderedEditable && !showSource,
    commentsOpen,
    unresolvedComments,
    defaultToolsOpen: !compact,
    paperPath,
    filePath,
    refreshVersion,
    onFormat: (action: MarkdownFormatAction) => applyFormat(action, compactTargetPane),
    onToggleComments: () => setCommentsOpen((open) => !open),
    onInsertInlineNote: () => insertInlineNote(compactTargetPane),
    onInsertSnippet: (snippet: string) => insertSnippet(snippet, compactTargetPane),
  };

  const compactToolbar = compact ? <MarkdownToolbar {...toolbarProps} embedded /> : null;

  const sourcePane = (
    <div className="flex min-h-0 flex-1 flex-col bg-editor">
      {!compact ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label">Source</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-ui-2xs text-muted-foreground">
                {statusText}
                {unitStatus ? ` · ${unitStatus}` : ""}
              </span>
            </div>
          </div>
          <MarkdownToolbar
            {...toolbarProps}
            renderedMode={false}
            onFormat={(action) => applyFormat(action, "source")}
            onInsertInlineNote={() => insertInlineNote("source")}
            onInsertSnippet={(snippet) => insertSnippet(snippet, "source")}
          />
        </>
      ) : null}
      <HighlightingTextarea
        inputRef={sourceRef}
        className="min-h-0 flex-1 p-4 font-mono text-[13px] leading-6"
        mirrorClassName="p-4 font-mono text-[13px] leading-6"
        value={content}
        baseline={approvedBaseline}
        highlight={requiresApproval && isPendingApproval}
        spellCheck={false}
        aria-label={`Edit source ${filePath}`}
        onChange={(e) => setContent(e.target.value)}
        onSelect={updateSelectedLine}
        onKeyUp={updateSelectedLine}
        onClick={updateSelectedLine}
        onKeyDown={onTextareaKeyDown}
      />
    </div>
  );

  const previewPane = (
    <div className="flex min-h-0 flex-1 flex-col bg-reading">
      {!compact ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label truncate">Preview</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden text-ui-2xs text-muted-foreground sm:inline">
                {statusText}
              </span>
              {modeToggle}
            </div>
          </div>
          {renderedEditable ? (
            <MarkdownToolbar
              {...toolbarProps}
              renderedMode={true}
              onFormat={(action) => applyFormat(action, "preview")}
              onInsertInlineNote={() => insertInlineNote("preview")}
              onInsertSnippet={(snippet) => insertSnippet(snippet, "preview")}
            />
          ) : null}
        </>
      ) : null}
      <div
        className={cn(
          "markdown-preview-edit min-h-0 flex-1 overflow-auto px-6 py-5",
          compact && "markdown-pane",
        )}
      >
        {renderedEditable ? (
          <div className="flex flex-col gap-4">
            {previewMeta.title ? (
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {previewMeta.title}
              </h1>
            ) : null}
            <RenderedMarkdownField
              inputRef={previewRef}
              value={previewBody}
              approvedBaseline={approvedPreviewBody}
              highlightPending={requiresApproval && isPendingApproval}
              compact={compact}
              showPreview={!compact}
              ariaLabel={`Edit ${paneLabel ?? "document"} ${filePath}`}
              placeholder="Write here…"
              linkContextPath={linkContextPath || parentPath(filePath)}
              linksClickable={Boolean(onNavigate)}
              onNavigate={onNavigate}
              onChange={handlePreviewBodyChange}
              onSelect={updateSelectedLine}
              onKeyDown={onTextareaKeyDown}
            />
          </div>
        ) : (
          <>
            {previewMeta.title ? (
              <h1 className="mb-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
                {previewMeta.title}
              </h1>
            ) : null}
            {previewBody.trim() ? (
              <MarkdownViewer
                markdown={previewBody}
                linkContextPath={linkContextPath || parentPath(filePath)}
                linksClickable={Boolean(onNavigate)}
                onNavigate={onNavigate}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">Empty document.</p>
            )}
          </>
        )}
      </div>
    </div>
  );

  const editorPanes =
    effectiveLayout === "split" && !compact && onSplitChange ? (
      <ResizableDualPane
        splitPercent={splitPercent}
        onSplitChange={onSplitChange}
        className="min-h-0 flex-1"
        left={sourcePane}
        right={previewPane}
      />
    ) : (
      <div
        className={cn(
          "editor-panes grid min-h-0 flex-1",
          effectiveLayout === "split" ? "editor-panes-split" : "grid-cols-1",
        )}
      >
        {showSource ? sourcePane : null}
        {showPreview ? previewPane : null}
      </div>
    );

  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {otherEditor ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100">
            Being edited by {otherEditor}
          </div>
        ) : null}
        <DraftApprovalBar
          pendingSource={isPendingApproval ? pendingSource : null}
          editedBy={githubHandle || editMeta.editedBy}
          aiAssisted={pendingSource === "ai" || editMeta.aiAssisted}
          onApprove={() => void handleApproveDraft()}
          onDiscard={() => void handleDiscardDraft()}
          approving={saveState === "saving"}
        />
        {isPendingApproval ? (
          <PendingChangesPanel baseline={approvedBaseline} current={content} />
        ) : null}
        {loadError ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {loadError}
          </div>
        ) : null}

        {compact ? (
          <div className="ui-pane-header gap-2 overflow-visible">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-visible">
              <span className="ui-label shrink-0 truncate">{paneLabel ?? "Document"}</span>
              {compactToolbar}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-ui-2xs text-muted-foreground">
                {statusText}
                {unitStatus ? ` · ${unitStatus}` : ""}
              </span>
              {canDispatch && dispatchAction ? (
                <DispatchAiButton
                  actionLabel={dispatchActionLabel(dispatchAction)}
                  dispatching={dispatching}
                  progress={dispatchProgress}
                  onClick={() => void handleDispatch()}
                />
              ) : null}
              {modeToggle}
            </div>
          </div>
        ) : null}

        {editorPanes}
      </div>
      {commentsOpen ? (
        <CommentsPanel
          filePath={filePath}
          paneLabel={paneLabel}
          refreshVersion={refreshVersion}
          selectedLine={selectedLine}
          onError={onError}
          onClose={() => setCommentsOpen(false)}
          onUnresolvedChange={setUnresolvedComments}
        />
      ) : null}
    </div>
  );
}
