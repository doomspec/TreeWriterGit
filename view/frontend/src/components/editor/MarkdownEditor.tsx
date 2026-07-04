import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EditorAssetAutocompleteLayer,
  EditorCommentsOverlay,
  EditorShell,
} from "@/components/editor/EditorShell";
import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { DraftApprovalRail } from "@/components/editor/DraftApprovalRail";
import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";
import { ReadingFocusFloatingBar } from "@/components/editor/ReadingFocusFloatingBar";
import { InlineSelectionToolbar } from "@/components/editor/InlineSelectionToolbar";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { MarkdownCompactEditBar } from "@/components/editor/markdown/MarkdownCompactEditBar";
import { useSelectionEditorTarget } from "@/lib/useSelectionEditorTarget";
import { MarkdownPreviewPane } from "@/components/editor/markdown/MarkdownPreviewPane";
import { lineInFullDocument, mergePreviewEdit, parsePreviewBody, splitForPreviewEdit } from "@/components/editor/markdown/previewBody";
import { MarkdownSourcePane } from "@/components/editor/markdown/MarkdownSourcePane";
import { resolveActivePane } from "@/components/editor/markdown/resolveActivePane";
import { useMarkdownAnnotations } from "@/components/editor/markdown/useMarkdownAnnotations";
import type { BlockMarkdownEditorHandle } from "@/components/editor/editorHandle";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { Eye, FileCode2 } from "lucide-react";
import { usePendingChangeNavigation } from "@/lib/usePendingChangeNavigation";
import { useSyncDocumentOutline } from "@/lib/documentOutline";
import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import { applyWithBlockEditorFirst } from "@/lib/useRenderedOrTextareaFormat";
import { handleFormatShortcut } from "@/lib/editor/formatShortcut";
import { handleListEnterKeyDown } from "@/lib/listAutocomplete";
import {
  isDispatchRunShortcut,
  unitPathFromUnitFile,
} from "@/lib/agentDispatchClient";
import { AnnotationBar } from "@/components/editor/AnnotationBar";
import { useEditorCrossRef } from "@/lib/hooks/useEditorCrossRef";
import { useEditorComments } from "@/lib/hooks/useEditorComments";
import {
  editorCommentLines,
  fileLineToEditorLine,
  unresolvedCommentFileLines,
} from "@/lib/commentLineHighlight";
import { useEditorDispatch } from "@/lib/hooks/useEditorDispatch";
import { useFileDocumentEditor } from "@/lib/hooks/useFileDocumentEditor";
import { authorNoteMacro, wrapInlineNote } from "@/lib/inlineNotes";
import { applyTextHighlight, restoreTextHighlightsFromMarkdown, type TextHighlightColorId } from "@/lib/textHighlight";
import { cn } from "@/lib/utils";
import { getUserName } from "@/lib/userIdentity";
import { parseFrontmatterStatus, isOutlinePath, isTempNotesPath, parentPath, type NavigateTarget } from "@/lib/modelTree";
import { TEMP_NOTES_EDITOR_PLACEHOLDER } from "@/lib/tempNotes";
import { draftStatusLabel, resolvePendingApprovalDisplay } from "@/lib/draftApproval";
import { effectiveDiffBaseline } from "@/lib/draftDiff";
import type { SaveState } from "@/lib/useDraftAutosave";
import { TextZoomControl } from "@/components/editor/TextZoomControl";
import { editorTextZoomStyle } from "@/lib/editorTextZoom";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";
import { handleEditorUndoRedoShortcuts } from "@/lib/editorUndoShortcuts";
import { markdownWordCount } from "@/lib/editorStats";
import { useReadingFocus } from "@/lib/readingFocus";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useAssetAutocomplete } from "@/lib/useAssetAutocomplete";
import { sessionKeyForFile, loadEditorSession, type EditorPaneMode } from "@/lib/editorSessionState";
import { scrollSourceToBibEntry, buildLineStartIndex } from "@/lib/bibEntrySource";
import { ensureBibEntry, getCachedBibEntry } from "@/lib/bibLibraryStore";
import { useEditorPresence } from "@/lib/hooks/useEditorPresence";
import { useReviewRailOpen } from "@/lib/useReviewRailOpen";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import type { EditorLayout } from "@/lib/editor/layout";

export type { EditorLayout } from "@/lib/editor/layout";
export type PaneEditMode = EditorPaneMode;

export function MarkdownEditor({
  filePath,
  refreshVersion,
  pathVersion = 0,
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
  headerExtra,
  enableDispatch = true,
  syncDocumentOutline = false,
  splitPaneTitle,
  showReadingFocusBar = true,
  scrollToBibCiteKey = null,
}: {
  filePath: string;
  refreshVersion: number;
  /** Per-path content version; combined with refreshVersion for file reload. */
  pathVersion?: number;
  layout: EditorLayout;
  compact?: boolean;
  paneLabel?: string;
  /** Short label shown in the focus edit bar when both panes are visible. */
  splitPaneTitle?: string;
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
  /** Extra controls shown in the compact pane header (e.g. section fan-out dispatch). */
  headerExtra?: React.ReactNode;
  /** When false, hides per-unit dispatch (section/paper composed views). */
  enableDispatch?: boolean;
  /** When true, feeds this editor's markdown into the sidebar document outline. */
  syncDocumentOutline?: boolean;
  /** When false, hides the reading-focus floating bar (multi-pane workspaces pass active pane). */
  showReadingFocusBar?: boolean;
  /** Scroll source selection to this BibTeX cite key (main.bib split view). */
  scrollToBibCiteKey?: string | null;
}) {
  const readingFocus = useReadingFocus();
  const nav = useWorkspaceNavigationContext();
  const [reviewRailOpen, toggleReviewRail] = useReviewRailOpen();
  const effectiveLinkContext = linkContextPath || parentPath(filePath);
  const activeOutlineNavPath = useMemo(() => {
    if (!isOutlinePath(filePath)) return null;
    const focus = nav.activeFile ? parentPath(nav.activeFile) : nav.browsePath;
    const context = effectiveLinkContext.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedFocus = focus.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!normalizedFocus || normalizedFocus === context) return null;
    return normalizedFocus;
  }, [effectiveLinkContext, filePath, nav.activeFile, nav.browsePath]);
  const dispatchSnapshotRef = useRef<string | null>(null);
  const {
    content,
    setContent,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    isDirty,
    isPendingApproval,
    sessionApprovalActive,
    pendingSource,
    setPendingSource,
    githubHandle,
    flushSave,
    handleApprove: handleApproveDraft,
    handleDiscard: handleDiscardDraft,
    restore,
    persist,
    loadedContent,
    approvedBaseline,
    loadError,
    editMeta,
    requiresApproval,
  } = useFileDocumentEditor({
    filePath,
    refreshVersion,
    pathVersion,
    defaultPaneMode,
    dispatchSnapshotRef,
    onError,
  });
  const editorStats = useMemo(() => markdownWordCount(content), [content]);
  const editorPlaceholder = isTempNotesPath(filePath)
    ? TEMP_NOTES_EDITOR_PLACEHOLDER
    : "Write here…";
  const [paneMode, setPaneMode] = useState<EditorPaneMode>(() => {
    const saved = loadEditorSession(sessionKeyForFile(filePath));
    const mode = saved?.paneMode ?? defaultPaneMode;
    if (mode === "raw") return "raw";
    if (mode === "changes") return "rendered";
    return "rendered";
  });
  const [previewRawEdit, setPreviewRawEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { unresolvedComments, comments, setUnresolvedComments, setComments } = useEditorComments(
    filePath,
    refreshVersion,
    pathVersion,
  );
  const [selectedLine, setSelectedLine] = useState(1);
  const { zoom, zoomIn, zoomOut, resetZoom } = useEditorTextZoom();
  const textZoomStyle = editorTextZoomStyle(zoom);
  const textZoomControl = (
    <TextZoomControl zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
  );
  const approvalLabel = useMemo(
    () => (filePath.endsWith("/outline.md") || filePath === "outline.md" ? "Approve outline" : "Approve draft"),
    [filePath],
  );

  const dispatchPane = paneLabel === "Outline" ? "outline" : paneLabel === "Draft" ? "draft" : undefined;
  const authorName = useMemo(() => getUserName(), []);
  const { otherEditor } = useEditorPresence(filePath, authorName);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLTextAreaElement | null>(null);
  const previewBlockRef = useRef<BlockMarkdownEditorHandle | null>(null);
  const [activeActions, setActiveActions] = useState<ReadonlySet<string>>(() => new Set());
  const handleActiveFormats = useCallback((actions: string[]) => setActiveActions(new Set(actions)), []);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceScrollRef = useRef<HTMLDivElement | null>(null);
  const editorScopeRef = useRef<HTMLDivElement | null>(null);
  const previewParts = useMemo(() => splitForPreviewEdit(content), [content]);
  const previewMeta = useMemo(() => parsePreviewBody(content), [content]);
  const previewBody = previewMeta.title ? previewMeta.body : previewParts.body;
  const debouncedPreviewBody = useDebouncedValue(previewBody, 250);
  const approvedPreviewMeta = useMemo(
    () => parsePreviewBody(approvedBaseline ?? ""),
    [approvedBaseline],
  );
  const approvedPreviewParts = useMemo(
    () => splitForPreviewEdit(approvedBaseline ?? ""),
    [approvedBaseline],
  );
  const approvedPreviewBody = approvedPreviewMeta.title
    ? approvedPreviewMeta.body
    : approvedPreviewParts.body;
  const diffBaseline = useMemo(
    () => effectiveDiffBaseline(approvedBaseline, loadedContent),
    [approvedBaseline, loadedContent],
  );
  const showPendingHighlights = sessionApprovalActive;
  const [pendingHighlightsReady, setPendingHighlightsReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPendingHighlightsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [readingFocus.active]);
  useEffect(() => {
    if (paneMode !== "raw") return;
    const restored = restoreTextHighlightsFromMarkdown(content);
    if (restored !== content) setContent(restored);
    // Normalize encoded highlights once when entering raw mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneMode]);
  const showInlinePendingHighlights = showPendingHighlights && pendingHighlightsReady;
  // "Clean preview": lets the author read the current text without the inline
  // tracked-changes diff, without discarding the pending approval state.
  const [cleanPreview, setCleanPreview] = useState(false);
  const effectivePendingHighlights = showInlinePendingHighlights && !cleanPreview;
  const isMainBibFile = filePath === "main.bib" || filePath.endsWith("/main.bib");
  const figureLabelIndex = useEditorCrossRef(paperPath, refreshVersion);

  const bibLineStarts = useMemo(() => {
    if (!isMainBibFile || !loadedContent) return null;
    return buildLineStartIndex(content.replace(/\r\n/g, "\n"));
  }, [content, isMainBibFile, loadedContent]);

  const debouncedScrollCiteKey = useDebouncedValue(scrollToBibCiteKey ?? "", 50);

  const loadedPreviewBody = useMemo(() => {
    const meta = parsePreviewBody(loadedContent);
    const parts = splitForPreviewEdit(loadedContent);
    return meta.title ? meta.body : parts.body;
  }, [loadedContent]);
  const unitStatus = useMemo(() => parseFrontmatterStatus(content), [content]);
  const unitPath = useMemo(() => unitPathFromUnitFile(filePath), [filePath]);
  const focusTitleContextPath = linkContextPath || parentPath(filePath);
  const {
    dispatchAction,
    canDispatch,
    dispatchProgress,
    dispatching,
    handleDispatch,
    handleOpenAiDispatch,
  } = useEditorDispatch({
    enabled: enableDispatch,
    compact,
    paneLabel,
    unitPath,
    previewBody,
    content,
    isFigureUnit,
    pane: dispatchPane,
    requiresApproval,
    approvedBaseline,
    flushSave,
    onBeforeDispatch,
    onDispatchComplete,
    onError,
    dispatchSnapshotRef,
  });

  const statusText = draftStatusLabel({
    requiresApproval,
    isPendingApproval,
    isDirty,
    saveState,
    defaultLabel: saveState,
  });

  useEffect(() => {
    setPreviewRawEdit(false);
    const saved = loadEditorSession(sessionKeyForFile(filePath));
    const mode = saved?.paneMode ?? defaultPaneMode;
    setPaneMode(mode === "raw" ? "raw" : "rendered");
    setPendingSource(null);
    dispatchSnapshotRef.current = null;
  }, [defaultPaneMode, filePath, setPendingSource]);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    onContentChange?.(content);
  }, [content, onContentChange]);

  const unresolvedFileLines = useMemo(() => unresolvedCommentFileLines(comments), [comments]);
  const sourceCommentLines = useMemo(
    () => editorCommentLines(unresolvedFileLines, content, content),
    [content, unresolvedFileLines],
  );
  const previewCommentLines = useMemo(
    () => editorCommentLines(unresolvedFileLines, content, previewBody),
    [content, previewBody, unresolvedFileLines],
  );
  const activeSourceCommentLine = commentsOpen
    ? fileLineToEditorLine(selectedLine, content, content)
    : null;
  const activePreviewCommentLine = commentsOpen
    ? fileLineToEditorLine(selectedLine, content, previewBody)
    : null;

  const { annotationIndex, annotationItems, handleAnnotationIndexChange } = useMarkdownAnnotations({
    commentsOpen,
    filePath,
    refreshVersion,
    pathVersion,
    setSelectedLine,
    preloadedComments: comments,
  });

  const effectiveLayout = compact ? (paneMode === "raw" ? "source" : "preview") : layout;
  const showSource = effectiveLayout === "source" || effectiveLayout === "split";
  const showPreview = effectiveLayout === "preview" || effectiveLayout === "split";
  const renderedEditable = compact ? paneMode === "rendered" : previewRawEdit;
  // On the PM surface, route undo/redo to its own history so the toolbar and
  // keyboard share one stack (legacy string history is used otherwise).
  const previewUndo = useCallback(() => {
    if (renderedEditable && previewBlockRef.current?.runUndo) previewBlockRef.current.runUndo();
    else undo();
  }, [renderedEditable, undo]);
  const previewRedo = useCallback(() => {
    if (renderedEditable && previewBlockRef.current?.runRedo) previewBlockRef.current.runRedo();
    else redo();
  }, [renderedEditable, redo]);
  const previewCanUndo =
    renderedEditable && previewBlockRef.current?.canUndo ? previewBlockRef.current.canUndo() : canUndo;
  const previewCanRedo =
    renderedEditable && previewBlockRef.current?.canRedo ? previewBlockRef.current.canRedo() : canRedo;
  const bindOutlineScroll = useSyncDocumentOutline(
    content,
    previewScrollRef,
    syncDocumentOutline && renderedEditable && showPreview,
    linkContextPath,
  );

  const getActiveTextarea = useCallback((): HTMLTextAreaElement | null => {
    if (compact) {
      return paneMode === "raw" ? sourceRef.current : previewRef.current;
    }
    if (showSource && document.activeElement === sourceRef.current) return sourceRef.current;
    return previewRef.current ?? sourceRef.current;
  }, [compact, paneMode, showSource]);

  const getScrollElement = useCallback((): HTMLElement | null => {
    if (compact) {
      return paneMode === "raw" ? sourceScrollRef.current : previewScrollRef.current;
    }
    return previewScrollRef.current ?? sourceScrollRef.current;
  }, [compact, paneMode]);

  const pendingChangeNavigation = usePendingChangeNavigation(
    getScrollElement,
    showInlinePendingHighlights,
    `${content.length}:${previewBody.length}:${paneMode}`,
  );

  useEffect(() => {
    if (!showInlinePendingHighlights) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        pendingChangeNavigation.goToNext();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        pendingChangeNavigation.goToPrevious();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    pendingChangeNavigation.goToNext,
    pendingChangeNavigation.goToPrevious,
    showInlinePendingHighlights,
  ]);

  const approvalDisplay = resolvePendingApprovalDisplay({
    editMeta,
    pendingSource,
    githubHandle,
    isDirty,
  });

  const approvalBar = sessionApprovalActive ? (
    <DraftApprovalBar
      pendingSource={approvalDisplay.pendingSource}
      editedBy={approvalDisplay.editedBy}
      aiAssisted={approvalDisplay.aiAssisted}
      aiProvider={approvalDisplay.aiProvider}
      approvers={editMeta.approvers ?? []}
      gitCommit={editMeta.gitCommit ?? null}
      onApprove={() => void handleApproveDraft()}
      onDiscard={() => void handleDiscardDraft()}
      approving={saveState === "saving"}
      approveLabel={approvalLabel}
      changeNavigation={pendingChangeNavigation}
      reviewRailOpen={reviewRailOpen}
      onToggleReviewRail={toggleReviewRail}
    />
  ) : null;

  const approvalRail =
    sessionApprovalActive && reviewRailOpen ? (
      <DraftApprovalRail
        pendingSource={approvalDisplay.pendingSource}
        editedBy={approvalDisplay.editedBy}
        aiAssisted={approvalDisplay.aiAssisted}
        aiProvider={approvalDisplay.aiProvider}
        onApprove={() => void handleApproveDraft()}
        onDiscard={() => void handleDiscardDraft()}
        approving={saveState === "saving"}
        approveLabel={approvalLabel}
        approvedBaseline={diffBaseline}
        loadedContent={loadedContent}
        current={content}
      />
    ) : null;

  const persistEditorSession = useCallback(() => {
    persist(getActiveTextarea(), getScrollElement(), paneMode);
  }, [getActiveTextarea, getScrollElement, paneMode, persist]);

  useEffect(() => {
    if (!loadedContent) return;
    const isMainBib = filePath === "main.bib" || filePath.endsWith("/main.bib");
    if (isMainBib && scrollToBibCiteKey) return;
    restore(getActiveTextarea(), getScrollElement(), setPaneMode);
  }, [filePath, getActiveTextarea, getScrollElement, loadedContent, restore, scrollToBibCiteKey]);

  useEffect(() => {
    if (!debouncedScrollCiteKey || !showSource || !isMainBibFile) return;

    let cancelled = false;
    let retryTimer: number | undefined;

    const attemptScroll = (attempt = 0) => {
      if (cancelled) return;
      const textarea = sourceRef.current;
      if (!textarea) {
        if (attempt < 20) retryTimer = window.setTimeout(() => attemptScroll(attempt + 1), 50);
        return;
      }
      const body = textarea.value || content;
      if (!body.trim()) {
        if (attempt < 20) retryTimer = window.setTimeout(() => attemptScroll(attempt + 1), 50);
        return;
      }

      const runScroll = (sourceRange?: { start: number; end: number }) => {
        if (cancelled) return;
        scrollSourceToBibEntry(textarea, body, debouncedScrollCiteKey, {
          sourceRange,
          lineStarts: bibLineStarts ?? undefined,
        });
      };

      const cached = getCachedBibEntry(debouncedScrollCiteKey);
      if (cached?.sourceRange) {
        runScroll(cached.sourceRange);
        return;
      }

      void ensureBibEntry(debouncedScrollCiteKey)
        .then((entry) => {
          if (cancelled) return;
          runScroll(entry.sourceRange);
        })
        .catch(() => {
          if (!cancelled && attempt < 10) {
            retryTimer = window.setTimeout(() => attemptScroll(attempt + 1), 100);
          }
        });
    };

    const frame = window.requestAnimationFrame(() => attemptScroll());
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [
    bibLineStarts,
    content,
    debouncedScrollCiteKey,
    isMainBibFile,
    loadedContent,
    showSource,
    pathVersion,
    filePath,
  ]);

  useEffect(() => {
    const scrollEl = getScrollElement();
    if (!scrollEl) return;
    let timer: number | undefined;
    const schedulePersist = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => persistEditorSession(), 250);
    };
    scrollEl.addEventListener("scroll", schedulePersist, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", schedulePersist);
      window.clearTimeout(timer);
      persistEditorSession();
    };
  }, [filePath, getScrollElement, paneMode, persistEditorSession]);

  const updateSelectedLine = useCallback(() => {
    if (renderedEditable && previewBlockRef.current) {
      const previewLine = previewBlockRef.current.getCursorLineNumber();
      if (previewLine != null) {
        setSelectedLine(lineInFullDocument(content, previewBody, previewLine));
        persistEditorSession();
        return;
      }
    }
    const el = getActiveTextarea();
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    setSelectedLine(before.split("\n").length);
    persistEditorSession();
  }, [content, getActiveTextarea, persistEditorSession, previewBody, renderedEditable]);

  const handlePreviewBodyChange = useCallback(
    (body: string) => {
      const withHeading = previewMeta.title
        ? `# ${previewMeta.title}\n\n${body.replace(/^\s+/, "")}`
        : body;
      setContent(mergePreviewEdit(previewParts.frontmatter, withHeading));
    },
    [previewMeta.title, previewParts.frontmatter],
  );

  const assetAutocomplete = useAssetAutocomplete({
    paperPath,
    filePath,
    refreshVersion,
    enabled: Boolean(paperPath),
  });

  const applyAssetAutocomplete = useCallback(
    (textarea: HTMLTextAreaElement, value: string) => {
      if (textarea === previewRef.current) {
        handlePreviewBodyChange(value);
      } else {
        setContent(value);
      }
      requestAnimationFrame(() => {
        updateSelectedLine();
      });
    },
    [handlePreviewBodyChange, updateSelectedLine],
  );

  const insertInlineNote = useCallback(
    (targetPane?: "preview" | "source") => {
      if (targetPane !== "source" && renderedEditable && previewBlockRef.current?.runInlineNote?.()) {
        return;
      }
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      const { usePreview, target } = resolveActivePane({
        targetPane,
        previewEl,
        sourceEl,
        renderedEditable,
        showPreview,
        showSource,
      });
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

  const insertTextHighlight = useCallback(
    (colorId: TextHighlightColorId, targetPane?: "preview" | "source") => {
      if (targetPane !== "source" && renderedEditable && previewBlockRef.current?.runHighlight?.(colorId)) {
        return;
      }
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      const { usePreview, target } = resolveActivePane({
        targetPane,
        previewEl,
        sourceEl,
        renderedEditable,
        showPreview,
        showSource,
      });
      if (!target) return;

      if (usePreview && previewBlockRef.current) {
        const transform = (value: string, start: number, end: number) =>
          applyTextHighlight(value, start, end, colorId);
        if (previewBlockRef.current.applyToRenderedSelection(transform)) return;
        if (previewBlockRef.current.applyToActiveBlock(transform)) return;
      }

      if (usePreview && renderedEditable) return;

      const currentValue = usePreview ? previewBody : content;
      const setValue = usePreview ? handlePreviewBodyChange : setContent;
      const result = applyTextHighlight(
        currentValue,
        target.selectionStart,
        target.selectionEnd,
        colorId,
      );
      setValue(result.value);
      requestAnimationFrame(() => {
        target.focus();
        target.setSelectionRange(result.selectionStart, result.selectionEnd);
        updateSelectedLine();
      });
    },
    [content, handlePreviewBodyChange, previewBody, renderedEditable, showPreview, showSource, updateSelectedLine],
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
      if (
        targetPane !== "source" &&
        renderedEditable &&
        previewBlockRef.current?.insertSnippet(snippet)
      ) {
        return;
      }
      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      const { usePreview, target } = resolveActivePane({
        targetPane,
        previewEl,
        sourceEl,
        renderedEditable,
        showPreview,
        showSource,
      });
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

  useEffect(() => {
    nav.registerEditorInsertSnippet((snippet) => insertSnippet(snippet));
    return () => nav.registerEditorInsertSnippet(null);
  }, [insertSnippet, nav]);

  const applyFormat = useCallback(
    (action: MarkdownFormatAction, targetPane?: "preview" | "source") => {
      // Native ProseMirror command path. The PM surface has no textarea, so
      // this must run before the target guard below (which would early-return).
      if (targetPane !== "source" && renderedEditable && previewBlockRef.current?.runFormat?.(action)) {
        return;
      }

      const previewEl = previewRef.current;
      const sourceEl = sourceRef.current;
      const { usePreview, target } = resolveActivePane({
        targetPane,
        previewEl,
        sourceEl,
        renderedEditable,
        showPreview,
        showSource,
      });
      if (!target) return;

      if (usePreview && previewBlockRef.current) {
        const transform = (value: string, start: number, end: number) =>
          applyMarkdownFormat(value, start, end, action);
        applyWithBlockEditorFirst(previewBlockRef.current, renderedEditable, transform, () => {});
        if (renderedEditable) return;
      }

      if (usePreview && renderedEditable) return;

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
      if (handleEditorUndoRedoShortcuts(event, { undo, redo })) return;

      if (
        assetAutocomplete.handleKeyDown(event, (value) => {
          applyAssetAutocomplete(event.currentTarget, value);
        })
      ) {
        return;
      }
      if (canDispatch && isDispatchRunShortcut(event)) {
        event.preventDefault();
        void handleDispatch();
        return;
      }

      const target = event.currentTarget;
      const usePreview = target === previewRef.current;
      const setValue = usePreview ? handlePreviewBodyChange : setContent;
      if (
        handleListEnterKeyDown({
          event,
          value: target.value,
          selectionStart: target.selectionStart,
          selectionEnd: target.selectionEnd,
          apply: (result) => {
            setValue(result.value);
            requestAnimationFrame(() => {
              target.focus();
              target.setSelectionRange(result.selectionStart, result.selectionEnd);
              updateSelectedLine();
            });
          },
        })
      ) {
        return;
      }

      handleFormatShortcut(event, (action) => applyFormat(action));
    },
    [
      applyAssetAutocomplete,
      applyFormat,
      assetAutocomplete,
      canDispatch,
      handleDispatch,
      handlePreviewBodyChange,
      redo,
      undo,
    ],
  );

  const onPreviewKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (handleEditorUndoRedoShortcuts(event, { undo, redo })) return;
      onTextareaKeyDown(event as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    },
    [onTextareaKeyDown, redo, undo],
  );

  const modeToggle = compact ? (
    <EditorPaneModeToggle
      paneMode={paneMode}
      onPaneModeChange={setPaneMode}
      ariaLabel={`${paneLabel ?? "Document"} editing mode`}
      reviewMode={effectivePendingHighlights && paneMode === "rendered"}
      pendingDiffAvailable={showInlinePendingHighlights}
      cleanPreview={cleanPreview}
      onCleanPreviewChange={setCleanPreview}
    />
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
    paperPath,
    filePath,
    refreshVersion,
    onFormat: (action: MarkdownFormatAction) => applyFormat(action, compactTargetPane),
    onToggleComments: () => setCommentsOpen((open) => !open),
    onInsertInlineNote: () => insertInlineNote(compactTargetPane),
    onInsertHighlight: (color: TextHighlightColorId) => insertTextHighlight(color, compactTargetPane),
    onInsertSnippet: (snippet: string) => insertSnippet(snippet, compactTargetPane),
    activeActions,
  };

  const focusToolbarTarget: "preview" | "source" = compact
    ? compactTargetPane
    : showPreview && renderedEditable
      ? "preview"
      : "source";

  const selectionEditorTarget = useSelectionEditorTarget(
    editorScopeRef,
    sourceScrollRef,
    !compact,
    focusToolbarTarget,
  );
  const inlineToolbarTarget = compact ? focusToolbarTarget : selectionEditorTarget;

  const paneEditBar = compact || readingFocus.active ? (
    <MarkdownCompactEditBar
      title={splitPaneTitle ?? paneLabel ?? "Document"}
      editorScopeRef={editorScopeRef}
      readingFocusActive={readingFocus.active}
      renderedEditable={renderedEditable}
      toolbarProps={toolbarProps}
      focusToolbarTarget={focusToolbarTarget}
      applyFormat={applyFormat}
      insertInlineNote={insertInlineNote}
      insertTextHighlight={insertTextHighlight}
      insertSnippet={insertSnippet}
      modeToggle={modeToggle}
      canDispatch={canDispatch}
      dispatchAction={dispatchAction}
      dispatching={dispatching}
      dispatchProgress={dispatchProgress}
      handleOpenAiDispatch={handleOpenAiDispatch}
      headerExtra={headerExtra}
      unitStatus={unitStatus}
      statusText={statusText}
      canUndo={previewCanUndo}
      canRedo={previewCanRedo}
      undo={previewUndo}
      redo={previewRedo}
      editorStats={editorStats}
      textZoomControl={textZoomControl}
    />
  ) : null;

  const sourcePane = (
    <MarkdownSourcePane
      compact={compact}
      readingFocusActive={readingFocus.active}
      textZoomStyle={textZoomStyle}
      sourceScrollRef={sourceScrollRef}
      sourceRef={sourceRef}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      textZoomControl={textZoomControl}
      statusText={statusText}
      unitStatus={unitStatus}
      toolbarProps={toolbarProps}
      applyFormat={applyFormat}
      insertInlineNote={insertInlineNote}
      insertTextHighlight={insertTextHighlight}
      insertSnippet={insertSnippet}
      content={content}
      diffBaseline={isMainBibFile ? content : diffBaseline}
      showInlinePendingHighlights={effectivePendingHighlights && !isMainBibFile}
      disableSourceMirrors={isMainBibFile}
      filePath={filePath}
      setContent={setContent}
      assetAutocomplete={assetAutocomplete}
      updateSelectedLine={updateSelectedLine}
      onTextareaKeyDown={onTextareaKeyDown}
      editorPlaceholder={editorPlaceholder}
      commentLines={sourceCommentLines}
      activeCommentLine={activeSourceCommentLine}
    />
  );

  const previewPane = (
    <MarkdownPreviewPane
      compact={compact}
      readingFocusActive={readingFocus.active}
      textZoomStyle={textZoomStyle}
      bindOutlineScroll={bindOutlineScroll}
      previewRef={previewRef}
      previewBlockRef={previewBlockRef}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      textZoomControl={textZoomControl}
      statusText={statusText}
      modeToggle={modeToggle}
      renderedEditable={renderedEditable}
      toolbarProps={toolbarProps}
      applyFormat={applyFormat}
      insertInlineNote={insertInlineNote}
      insertTextHighlight={insertTextHighlight}
      insertSnippet={insertSnippet}
      previewMeta={previewMeta}
      focusTitleContextPath={focusTitleContextPath}
      onNavigate={onNavigate}
      onActiveFormatsChange={handleActiveFormats}
      previewBody={previewBody}
      approvedPreviewBody={approvedPreviewBody}
      loadedPreviewBody={loadedPreviewBody}
      showInlinePendingHighlights={effectivePendingHighlights}
      figureLabelIndex={figureLabelIndex}
      approvalDisplay={approvalDisplay}
      handleApproveDraft={handleApproveDraft}
      handleDiscardDraft={handleDiscardDraft}
      saveState={saveState}
      approvalLabel={approvalLabel}
      filePath={filePath}
      paneLabel={paneLabel}
      linkContextPath={linkContextPath || parentPath(filePath)}
      refreshVersion={refreshVersion}
      activeOutlineNavPath={activeOutlineNavPath}
      handlePreviewBodyChange={handlePreviewBodyChange}
      updateSelectedLine={updateSelectedLine}
      assetAutocomplete={assetAutocomplete}
      onPreviewKeyDown={onPreviewKeyDown}
      debouncedPreviewBody={debouncedPreviewBody}
      editorPlaceholder={editorPlaceholder}
      commentLines={previewCommentLines}
      activeCommentLine={activePreviewCommentLine}
    />
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

  const commentsOverlay = compact;

  return (
    <EditorShell
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        commentsOverlay && "relative overflow-hidden",
        className,
      )}
      comments={
        <EditorCommentsOverlay
          open={commentsOpen}
          filePath={filePath}
          paneLabel={paneLabel}
          refreshVersion={refreshVersion}
          selectedLine={selectedLine}
          overlay={commentsOverlay}
          onClose={() => setCommentsOpen(false)}
          onError={onError}
          onUnresolvedChange={setUnresolvedComments}
          onCommentsChange={setComments}
          onNavigateToLine={setSelectedLine}
        />
      }
      autocomplete={
        <EditorAssetAutocompleteLayer
          autocomplete={assetAutocomplete}
          onApplyValue={(value) => {
            const textarea =
              (document.activeElement === previewRef.current && previewRef.current) ||
              (document.activeElement === sourceRef.current && sourceRef.current) ||
              sourceRef.current ||
              previewRef.current;
            if (!textarea) return;
            applyAssetAutocomplete(textarea, value);
          }}
        />
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {otherEditor ? (
          <div className={cn("border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100", readingFocus.active && "editor-chrome-hidden")}>
            Being edited by {otherEditor}
          </div>
        ) : null}
        {loadError ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {loadError}
          </div>
        ) : null}

        {paneEditBar}
        {approvalBar}
        {commentsOpen && annotationItems.length > 0 ? (
          <AnnotationBar
            items={annotationItems}
            index={annotationIndex}
            onIndexChange={handleAnnotationIndexChange}
            onClose={() => setCommentsOpen(false)}
          />
        ) : null}
        <div ref={editorScopeRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {editorPanes}
            <InlineSelectionToolbar
              scopeRef={editorScopeRef}
              enabled={readingFocus.active}
              toolbarProps={{
                ...toolbarProps,
                renderedMode: inlineToolbarTarget === "preview" && renderedEditable,
                onFormat: (action) => applyFormat(action, inlineToolbarTarget),
                onInsertInlineNote: () => insertInlineNote(inlineToolbarTarget),
                onInsertHighlight: (color) => insertTextHighlight(color, inlineToolbarTarget),
                onInsertSnippet: (snippet) => insertSnippet(snippet, inlineToolbarTarget),
              }}
            />
            {readingFocus.active && showReadingFocusBar ? (
              <div className="reading-focus-floating-bar-host">
                <ReadingFocusFloatingBar
                  className="reading-focus-floating-bar"
                  wordCount={editorStats.words}
                  charCount={editorStats.characters}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  onExit={readingFocus.exit}
                  paneMode={paneMode}
                  onPaneModeChange={setPaneMode}
                  paneLabel={paneLabel ?? "Document"}
                  pendingDiffAvailable={showInlinePendingHighlights}
                  cleanPreview={cleanPreview}
                  onCleanPreviewChange={setCleanPreview}
                />
              </div>
            ) : null}
        </div>
        </div>
        {approvalRail}
      </div>
    </EditorShell>
  );
}
