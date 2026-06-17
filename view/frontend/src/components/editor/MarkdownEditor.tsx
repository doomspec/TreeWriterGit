import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileCode2 } from "lucide-react";

import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
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
import { getUserName } from "@/lib/userIdentity";
import { parseFrontmatterStatus, parentPath, stripFrontmatter, type NavigateTarget } from "@/lib/modelTree";
import {
  ApiError,
  claimPresence,
  fetchComments,
  fetchPresence,
  heartbeatPresence,
  releasePresence,
} from "@/modelApi";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
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
}: {
  filePath: string;
  refreshVersion: number;
  layout: EditorLayout;
  compact?: boolean;
  paneLabel?: string;
  defaultPaneMode?: PaneEditMode;
  onSaveStateChange?: (state: SaveState) => void;
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
}) {
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paneMode, setPaneMode] = useState<PaneEditMode>(defaultPaneMode);
  const [previewRawEdit, setPreviewRawEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const [selectedLine, setSelectedLine] = useState(1);
  const [otherEditor, setOtherEditor] = useState<string | null>(null);
  const dispatchPane = paneLabel === "Outline" ? "outline" : paneLabel === "Draft" ? "draft" : undefined;
  const authorName = useMemo(() => getUserName(), []);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty = content !== loadedContent;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const previewParts = useMemo(() => splitForPreviewEdit(content), [content]);
  const previewMeta = useMemo(() => parsePreviewBody(content), [content]);
  const previewBody = previewMeta.title ? previewMeta.body : previewParts.body;
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

  const flushSave = useCallback(async () => {
    if (!isDirty) return;
    setSaveState("saving");
    try {
      const response = await fetch(`${apiBaseUrl}/api/model/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (response.status === 404) {
        const createRes = await fetch(`${apiBaseUrl}/api/model/file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content }),
        });
        if (!createRes.ok) throw new Error(`Failed to save ${filePath}`);
      } else if (!response.ok) {
        throw new Error(`Failed to save ${filePath}`);
      }
      setLoadedContent(content);
      setSaveState("saved");
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveState("error");
      setLoadError(message);
      throw err;
    }
  }, [content, filePath, isDirty]);

  const handleDispatch = useCallback(async () => {
    if (!canDispatch || !unitPath || !dispatchAction) return;
    try {
      await flushSave();
      await runUnitDispatch({
        unitPath,
        action: dispatchAction,
      });
      onDispatchComplete?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [canDispatch, dispatchAction, flushSave, onDispatchComplete, onError, runUnitDispatch, unitPath]);

  useEffect(() => {
    setPreviewRawEdit(false);
    setPaneMode(defaultPaneMode);
  }, [defaultPaneMode, filePath]);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

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
    const controller = new AbortController();
    if (isDirtyRef.current) {
      return () => controller.abort();
    }

    fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(filePath)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setContent("");
          setLoadedContent("");
          setSaveState("idle");
          setLoadError(null);
          return;
        }
        if (!response.ok) throw new Error(`Failed to load ${filePath}`);
        return (await response.json()) as { content: string };
      })
      .then((data) => {
        if (!data) return;
        setContent(data.content);
        setLoadedContent(data.content);
        setSaveState("idle");
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message);
          setSaveState("error");
          onError?.(message);
        }
      });

    return () => controller.abort();
  }, [filePath, onError, refreshVersion]);

  useEffect(() => {
    if (!isDirty) return;
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const nextContent = content;
      try {
        const response = await fetch(`${apiBaseUrl}/api/model/file`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content: nextContent }),
        });
        if (response.status === 404) {
          const createRes = await fetch(`${apiBaseUrl}/api/model/file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath, content: nextContent }),
          });
          if (!createRes.ok) throw new Error(`Failed to save ${filePath}`);
        } else if (!response.ok) {
          throw new Error(`Failed to save ${filePath}`);
        }
        setLoadedContent(nextContent);
        setSaveState("saved");
        setLoadError(null);
        window.setTimeout(() => setSaveState("idle"), 900);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveState("error");
        setLoadError(message);
        onError?.(message);
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [content, filePath, isDirty, onError]);

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
      const nextValue = `${currentValue.slice(0, start)}${note}${currentValue.slice(end)}`;
      setValue(nextValue);
      requestAnimationFrame(() => {
        target.focus();
        const cursor = start + note.length;
        target.setSelectionRange(cursor, cursor);
        updateSelectedLine();
      });
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
        title="Rendered editing"
        onClick={() => setPaneMode("rendered")}
      >
        <Eye className="h-3 w-3" aria-hidden="true" />
        Rendered
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
    onFormat: (action: MarkdownFormatAction) => applyFormat(action, compactTargetPane),
    onToggleComments: () => setCommentsOpen((open) => !open),
    onInsertInlineNote: () => insertInlineNote(compactTargetPane),
  };

  const compactToolbar = compact ? <MarkdownToolbar {...toolbarProps} /> : null;

  const sourcePane = (
    <div className="flex min-h-0 flex-col bg-editor">
      {!compact ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label">Source</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-ui-2xs text-muted-foreground">
                {isDirty ? "unsaved" : saveState}
                {unitStatus ? ` · ${unitStatus}` : ""}
              </span>
            </div>
          </div>
          <MarkdownToolbar
            {...toolbarProps}
            renderedMode={false}
            onFormat={(action) => applyFormat(action, "source")}
            onInsertInlineNote={() => insertInlineNote("source")}
          />
        </>
      ) : null}
      <textarea
        ref={sourceRef}
        className="min-h-0 flex-1 resize-none overflow-auto border-0 bg-transparent p-4 font-mono text-[13px] leading-6 outline-none focus:ring-0"
        value={content}
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
    <div className="flex min-h-0 flex-col bg-reading">
      {!compact ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label truncate">Preview</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden text-ui-2xs text-muted-foreground sm:inline">
                {isDirty ? "unsaved" : saveState}
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
          <div className="flex min-h-full flex-col gap-4">
            {previewMeta.title ? (
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {previewMeta.title}
              </h1>
            ) : null}
            <RenderedMarkdownField
              inputRef={previewRef}
              value={previewBody}
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
        {loadError ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {loadError}
          </div>
        ) : null}

        {compact ? (
          <div className="ui-pane-header">
            <span className="ui-label truncate">{paneLabel ?? "Document"}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-ui-2xs text-muted-foreground">
                {isDirty ? "unsaved" : saveState}
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

        {compactToolbar}

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
