import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssetAutocompletePopup } from "@/components/editor/AssetAutocompletePopup";
import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { DispatchAiButton } from "@/components/editor/DispatchAiButton";
import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";
import { EditorPaneOverflowMenu } from "@/components/editor/EditorPaneOverflowMenu";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { ReadingFocusEditBar } from "@/components/editor/ReadingFocusEditBar";
import { ReadingFocusFloatingBar } from "@/components/editor/ReadingFocusFloatingBar";
import { ReadingFocusDocumentLayout } from "@/components/editor/ReadingFocusDocumentLayout";
import { ReadingFocusTitleLink } from "@/components/editor/ReadingFocusTitleLink";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import type { BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import { ResizableDualPane } from "@/components/layout/ResizableDualPane";
import { Button } from "@/components/ui/button";
import { Eye, FileCode2 } from "lucide-react";
import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import { handleFormatShortcut } from "@/lib/editor/formatShortcut";
import { handleListEnterKeyDown } from "@/lib/listAutocomplete";
import {
  dispatchActionForUnitPane,
  dispatchActionLabel,
  isDispatchRunShortcut,
  unitPathFromUnitFile,
} from "@/lib/agentDispatchClient";
import { useAgentDispatchPanelOptional } from "@/lib/agentDispatchPanel";
import { useDispatchJob } from "@/lib/useDispatchJob";
import { authorNoteMacro, wrapInlineNote } from "@/lib/inlineNotes";
import { applyTextHighlight, type TextHighlightColorId } from "@/lib/textHighlight";
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
import { effectiveDiffBaseline } from "@/lib/draftDiff";
import { useDraftAutosave, type SaveState } from "@/lib/useDraftAutosave";
import { useEditorDirty } from "@/lib/editorDirtyRegistry";
import { TextZoomControl } from "@/components/editor/TextZoomControl";
import { editorTextZoomStyle } from "@/lib/editorTextZoom";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";
import { useEditorHistory } from "@/lib/useEditorHistory";
import { handleEditorUndoRedoShortcuts } from "@/lib/editorUndoShortcuts";
import { markdownWordCount } from "@/lib/editorStats";
import { useReadingFocus } from "@/lib/readingFocus";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useAssetAutocomplete } from "@/lib/useAssetAutocomplete";
import { sessionKeyForFile, loadEditorSession, type EditorPaneMode } from "@/lib/editorSessionState";
import { usePersistedEditorSession } from "@/lib/usePersistedEditorSession";
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
export type PaneEditMode = EditorPaneMode;

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
  headerExtra,
  enableDispatch = true,
  showFocusGraph = true,
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
  /** Extra controls shown in the compact pane header (e.g. section fan-out dispatch). */
  headerExtra?: React.ReactNode;
  /** When false, hides per-unit dispatch (section/paper composed views). */
  enableDispatch?: boolean;
  /** Show the reading-focus link graph in this pane (off for draft in Both view). */
  showFocusGraph?: boolean;
}) {
  const {
    value: content,
    setValue: setContent,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorHistory("");
  const readingFocus = useReadingFocus();
  const editorStats = useMemo(() => markdownWordCount(content), [content]);
  const [loadedContent, setLoadedContent] = useState("");
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paneMode, setPaneMode] = useState<EditorPaneMode>(() => {
    const saved = loadEditorSession(sessionKeyForFile(filePath));
    const mode = saved?.paneMode ?? defaultPaneMode;
    if (mode === "raw") return "raw";
    if (mode === "changes") return "rendered";
    return "rendered";
  });
  const [previewRawEdit, setPreviewRawEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const [selectedLine, setSelectedLine] = useState(1);
  const [otherEditor, setOtherEditor] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState<DraftEditMeta>({
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    approvedBy: null,
    approvedAt: null,
  });
  const dispatchSnapshotRef = useRef<string | null>(null);
  const { zoom, zoomIn, zoomOut, resetZoom } = useEditorTextZoom();
  const textZoomStyle = editorTextZoomStyle(zoom);
  const textZoomControl = (
    <TextZoomControl zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
  );
  const requiresApproval = useMemo(() => requiresDraftApproval(filePath), [filePath]);
  const approvalLabel = useMemo(
    () => (filePath.endsWith("/outline.md") || filePath === "outline.md" ? "Approve outline" : "Approve draft"),
    [filePath],
  );

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
          aiProvider:
            pendingSource === "ai"
              ? draftSaveMeta("ai").aiProvider ?? prev.aiProvider
              : prev.aiProvider,
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
      resetHistory(restored);
      setLoadedContent(restored);
      void loadDraftApprovalState(filePath).then(({ meta }) => setEditMeta(meta));
      dispatchSnapshotRef.current = null;
      setLoadError(null);
    },
    requiresApproval,
  });

  useEditorDirty(isDirty);

  const dispatchPane = paneLabel === "Outline" ? "outline" : paneLabel === "Draft" ? "draft" : undefined;
  const authorName = useMemo(() => getUserName(), []);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLTextAreaElement | null>(null);
  const previewBlockRef = useRef<BlockMarkdownEditorHandle | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceScrollRef = useRef<HTMLDivElement | null>(null);
  const editorSessionKey = sessionKeyForFile(filePath);
  const { restore, persist } = usePersistedEditorSession(editorSessionKey);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const loadedContentRef = useRef(loadedContent);
  loadedContentRef.current = loadedContent;
  const approvedBaselineRef = useRef(approvedBaseline);
  approvedBaselineRef.current = approvedBaseline;
  const previewParts = useMemo(() => splitForPreviewEdit(content), [content]);
  const previewMeta = useMemo(() => parsePreviewBody(content), [content]);
  const previewBody = previewMeta.title ? previewMeta.body : previewParts.body;
  const debouncedPreviewBody = useDebouncedValue(previewBody, 250);
  const approvedPreviewMeta = useMemo(() => parsePreviewBody(approvedBaseline), [approvedBaseline]);
  const approvedPreviewParts = useMemo(() => splitForPreviewEdit(approvedBaseline), [approvedBaseline]);
  const approvedPreviewBody = approvedPreviewMeta.title
    ? approvedPreviewMeta.body
    : approvedPreviewParts.body;
  const diffBaseline = useMemo(
    () => effectiveDiffBaseline(approvedBaseline, loadedContent),
    [approvedBaseline, loadedContent],
  );
  const showPendingHighlights = isPendingApproval;
  const [pendingHighlightsReady, setPendingHighlightsReady] = useState(!readingFocus.active);
  useEffect(() => {
    if (readingFocus.active) {
      setPendingHighlightsReady(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setPendingHighlightsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [readingFocus.active]);
  const showInlinePendingHighlights = showPendingHighlights && pendingHighlightsReady;
  const loadedPreviewBody = useMemo(() => {
    const meta = parsePreviewBody(loadedContent);
    const parts = splitForPreviewEdit(loadedContent);
    return meta.title ? meta.body : parts.body;
  }, [loadedContent]);
  const unitStatus = useMemo(() => parseFrontmatterStatus(content), [content]);
  const unitPath = useMemo(() => unitPathFromUnitFile(filePath), [filePath]);
  const focusTitleContextPath = linkContextPath || parentPath(filePath);
  const dispatchAction = useMemo(
    () =>
      enableDispatch
        ? dispatchActionForUnitPane(
            paneLabel,
            Boolean(previewBody.trim() || content.trim()),
            isFigureUnit,
          )
        : null,
    [content, enableDispatch, isFigureUnit, paneLabel, previewBody],
  );
  const canDispatch = Boolean(compact && unitPath && dispatchAction);
  const agentDispatchPanel = useAgentDispatchPanelOptional();
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

  const handleOpenAiDispatch = useCallback(() => {
    if (!canDispatch || !dispatchAction) return;
    if (agentDispatchPanel) {
      agentDispatchPanel.openDispatch({
        action: dispatchAction,
        pane: dispatchPane,
        autoPreview: true,
      });
      return;
    }
    void handleDispatch();
  }, [agentDispatchPanel, canDispatch, dispatchAction, dispatchPane, handleDispatch]);

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
        if (meta.aiAssisted) {
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
        const baseline = effectiveDiffBaseline(approvedBaselineRef.current, loadedContentRef.current);
        const unchangedOnDisk = diskContent === loadedContentRef.current;

        if (unchangedOnDisk && snapshot === null) {
          if (requiresApproval && diskContent !== baseline) {
            void loadDraftApprovalState(filePath).then(({ meta }) => {
              if (!cancelled) {
                setEditMeta(meta);
                if (meta.aiAssisted) {
                  setPendingSource((prev) => (prev === "human" ? prev : "ai"));
                }
              }
            });
          } else if (!requiresApproval || diskContent === baseline) {
            setPendingSource(null);
          }
          setSaveState("idle");
          setLoadError(null);
          return;
        }

        resetHistory(diskContent);
        setLoadedContent(diskContent);
        if (requiresApproval && snapshot !== null && diskContent !== snapshot) {
          setPendingSource("ai");
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) setEditMeta(meta);
          });
        } else if (requiresApproval && diskContent !== baseline) {
          void loadDraftApprovalState(filePath).then(({ meta }) => {
            if (!cancelled) {
              setEditMeta(meta);
              if (meta.aiAssisted) {
                setPendingSource((prev) => (prev === "human" ? prev : "ai"));
              }
            }
          });
        } else if (!requiresApproval || diskContent === baseline) {
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
  }, [filePath, onError, refreshVersion, requiresApproval, resetHistory, setPendingSource, setSaveState]);

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

  const effectiveLayout = compact ? (paneMode === "raw" ? "source" : "preview") : layout;
  const showSource = effectiveLayout === "source" || effectiveLayout === "split";
  const showPreview = effectiveLayout === "preview" || effectiveLayout === "split";
  const renderedEditable = compact ? paneMode === "rendered" : previewRawEdit;

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

  const persistEditorSession = useCallback(() => {
    persist(getActiveTextarea(), getScrollElement(), paneMode);
  }, [getActiveTextarea, getScrollElement, paneMode, persist]);

  useEffect(() => {
    if (!loadedContent) return;
    restore(getActiveTextarea(), getScrollElement(), setPaneMode);
  }, [filePath, getActiveTextarea, getScrollElement, loadedContent, restore]);

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
    const el = sourceRef.current ?? previewRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    setSelectedLine(before.split("\n").length);
    persistEditorSession();
  }, [persistEditorSession]);

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

  const insertTextHighlight = useCallback(
    (colorId: TextHighlightColorId, targetPane?: "preview" | "source") => {
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

      if (usePreview && previewBlockRef.current?.isBlockEditing()) {
        const applied = previewBlockRef.current.applyToActiveBlock((value, start, end) =>
          applyTextHighlight(value, start, end, colorId),
        );
        if (applied) return;
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

      if (usePreview && previewBlockRef.current?.isBlockEditing()) {
        const applied = previewBlockRef.current.applyToActiveBlock((value, start, end) =>
          applyMarkdownFormat(value, start, end, action),
        );
        if (applied) return;
      }

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
      reviewMode={showInlinePendingHighlights && paneMode === "rendered"}
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
  };

  const compactToolbar = compact ? <MarkdownToolbar {...toolbarProps} embedded /> : null;

  const focusToolbarTarget: "preview" | "source" = compact
    ? compactTargetPane
    : showPreview && renderedEditable
      ? "preview"
      : "source";

  const focusEditBar = readingFocus.active ? (
    <ReadingFocusEditBar
      toolbar={
        <MarkdownToolbar
          {...toolbarProps}
          embedded
          renderedMode={focusToolbarTarget === "preview" && renderedEditable}
          onFormat={(action) => applyFormat(action, focusToolbarTarget)}
          onInsertInlineNote={() => insertInlineNote(focusToolbarTarget)}
          onInsertHighlight={(color) => insertTextHighlight(color, focusToolbarTarget)}
          onInsertSnippet={(snippet) => insertSnippet(snippet, focusToolbarTarget)}
        />
      }
      trailing={
        <>
          {compact || renderedEditable ? modeToggle : null}
          {canDispatch && dispatchAction ? (
            <DispatchAiButton
              actionLabel={dispatchActionLabel(dispatchAction)}
              dispatching={dispatching}
              progress={dispatchProgress}
              onClick={handleOpenAiDispatch}
            />
          ) : null}
          {headerExtra}
        </>
      }
    />
  ) : null;

  const sourcePane = (
    <div
      ref={sourceScrollRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col bg-editor editor-text-zoom-root",
        compact && "overflow-auto",
      )}
      style={textZoomStyle}
    >
      {!compact && !readingFocus.active ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label">Source</span>
            <div className="flex items-center gap-1.5">
              <EditorUndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
              <EditorFocusToggle className="h-7 px-2" />
              {textZoomControl}
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
            onInsertHighlight={(color) => insertTextHighlight(color, "source")}
            onInsertSnippet={(snippet) => insertSnippet(snippet, "source")}
          />
        </>
      ) : null}
      <HighlightingTextarea
        fillContainer={!compact}
        inputRef={sourceRef}
        className={cn(
          "w-full font-mono text-[13px] leading-6",
          compact ? "min-h-[8rem] p-4" : "min-h-0 flex-1 p-4",
        )}
        mirrorClassName="p-4 font-mono text-[13px] leading-6"
        value={content}
        baseline={diffBaseline}
        highlight={showInlinePendingHighlights}
        spellCheck={false}
        aria-label={`Edit source ${filePath}`}
        onChange={(e) => {
          setContent(e.target.value);
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onSelect={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onKeyUp={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onClick={(e) => {
          updateSelectedLine();
          void assetAutocomplete.sync(e.currentTarget);
        }}
        onFocus={(e) => void assetAutocomplete.sync(e.currentTarget)}
        onBlur={(e) => assetAutocomplete.handleEditorBlur(e.currentTarget)}
        onKeyDown={onTextareaKeyDown}
      />
    </div>
  );

  const previewPane = (
    <div className="flex min-h-0 flex-1 flex-col bg-reading editor-text-zoom-root" style={textZoomStyle}>
      {!compact && !readingFocus.active ? (
        <>
          <div className="ui-pane-header h-8">
            <span className="ui-label truncate">Preview</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <EditorUndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
              <EditorFocusToggle className="h-7 px-2" />
              {textZoomControl}
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
              onInsertHighlight={(color) => insertTextHighlight(color, "preview")}
              onInsertSnippet={(snippet) => insertSnippet(snippet, "preview")}
            />
          ) : null}
        </>
      ) : null}
      <div
        ref={previewScrollRef}
        className={cn(
          "markdown-preview-edit min-h-0 flex-1 overflow-auto px-6 py-5",
          compact && "markdown-pane",
        )}
      >
        {renderedEditable ? (
          <ReadingFocusDocumentLayout
            showGraph={showFocusGraph}
            title={
              previewMeta.title ? (
                <ReadingFocusTitleLink
                  title={previewMeta.title}
                  contextPath={focusTitleContextPath}
                  onNavigate={onNavigate}
                />
              ) : null
            }
          >
            <RenderedMarkdownField
              inputRef={previewRef}
              editorRef={previewBlockRef}
              value={previewBody}
              approvedBaseline={approvedPreviewBody}
              loadedContent={loadedPreviewBody}
              highlightPending={showInlinePendingHighlights}
              pendingApproval={
                showInlinePendingHighlights
                  ? {
                      pendingSource: pendingSource ?? "human",
                      editedBy: githubHandle || editMeta.editedBy,
                      aiAssisted: pendingSource === "ai" || editMeta.aiAssisted,
                      aiProvider: editMeta.aiProvider,
                      loadedContent: loadedPreviewBody,
                      onApprove: () => void handleApproveDraft(),
                      onDiscard: () => void handleDiscardDraft(),
                      approving: saveState === "saving",
                      approveLabel: approvalLabel.replace(/^Approve /, ""),
                    }
                  : null
              }
              compact={compact}
              showPreview
              ariaLabel={`Edit ${paneLabel ?? "document"} ${filePath}`}
              placeholder="Write here…"
              linkContextPath={linkContextPath || parentPath(filePath)}
              linksClickable={Boolean(onNavigate)}
              onNavigate={onNavigate}
              onChange={handlePreviewBodyChange}
              onSelect={updateSelectedLine}
              onTextareaSync={(textarea) => void assetAutocomplete.sync(textarea)}
              onBlur={(event) => assetAutocomplete.handleEditorBlur(event.currentTarget)}
              onKeyDown={onPreviewKeyDown}
            />
          </ReadingFocusDocumentLayout>
        ) : (
          <ReadingFocusDocumentLayout
            showGraph={showFocusGraph}
            title={
              previewMeta.title ? (
                <ReadingFocusTitleLink
                  title={previewMeta.title}
                  contextPath={focusTitleContextPath}
                  onNavigate={onNavigate}
                  className="mb-0"
                />
              ) : null
            }
          >
            {debouncedPreviewBody.trim() ? (
              <MarkdownViewer
                markdown={debouncedPreviewBody}
                linkContextPath={linkContextPath || parentPath(filePath)}
                linksClickable={Boolean(onNavigate)}
                onNavigate={onNavigate}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">Empty document.</p>
            )}
          </ReadingFocusDocumentLayout>
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

  const commentsOverlay = compact;

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        commentsOverlay && "relative overflow-hidden",
        className,
      )}
    >
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

        {compact && !readingFocus.active ? (
          <div className="ui-pane-header shrink-0">
            <span className="ui-pane-header__label ui-label max-w-[5.5rem] shrink-0 truncate sm:max-w-[7rem]">
              {paneLabel ?? "Document"}
            </span>
            {compactToolbar ? (
              <div className="ui-pane-header__toolbar-slot min-w-0 flex-1 overflow-hidden">
                {compactToolbar}
              </div>
            ) : null}
            <div className="ui-pane-header__actions flex shrink-0 items-center gap-1">
              {modeToggle}
              <EditorPaneOverflowMenu
                  statusText={
                    unitStatus ? `${statusText} · ${unitStatus}` : statusText
                  }
                >
                  <div className="px-1 py-1">
                    <EditorUndoRedoButtons
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={undo}
                      onRedo={redo}
                    />
                  </div>
                  <div className="px-1 py-1">
                    <EditorFocusToggle />
                  </div>
                  <div className="px-1 py-1 font-mono text-[10px] text-muted-foreground">
                    {editorStats.words} words · {editorStats.characters} chars
                  </div>
                  <div className="px-1 py-1">{textZoomControl}</div>
                  {canDispatch && dispatchAction ? (
                    <div className="px-1 py-1">
                      <DispatchAiButton
                        actionLabel={dispatchActionLabel(dispatchAction)}
                        dispatching={dispatching}
                        progress={dispatchProgress}
                        onClick={handleOpenAiDispatch}
                      />
                    </div>
                  ) : null}
                  {headerExtra ? <div className="px-1 py-1">{headerExtra}</div> : null}
                </EditorPaneOverflowMenu>
            </div>
          </div>
        ) : null}

        {focusEditBar}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {editorPanes}
            {readingFocus.active ? (
              <ReadingFocusFloatingBar
                className="reading-focus-floating-bar"
                wordCount={editorStats.words}
                charCount={editorStats.characters}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onExit={readingFocus.exit}
              />
            ) : null}
        </div>
      </div>
      {commentsOpen ? (
        <>
          {commentsOverlay ? (
            <button
              type="button"
              className="absolute inset-0 z-10 bg-overlay/40 backdrop-blur-[1px]"
              aria-label="Close comments"
              onClick={() => setCommentsOpen(false)}
            />
          ) : null}
          <CommentsPanel
            filePath={filePath}
            paneLabel={paneLabel}
            refreshVersion={refreshVersion}
            selectedLine={selectedLine}
            overlay={commentsOverlay}
            onError={onError}
            onClose={() => setCommentsOpen(false)}
            onUnresolvedChange={setUnresolvedComments}
          />
        </>
      ) : null}
      <AssetAutocompletePopup
        open={assetAutocomplete.state.open}
        top={assetAutocomplete.state.position?.top ?? null}
        left={assetAutocomplete.state.position?.left ?? null}
        items={assetAutocomplete.state.items}
        selectedIndex={assetAutocomplete.state.selectedIndex}
        selectedCiteKeys={assetAutocomplete.state.selectedCiteKeys}
        attachedCiteKeys={assetAutocomplete.attachedCiteKeys}
        isCiteMode={assetAutocomplete.isCiteMode}
        loading={assetAutocomplete.state.loading}
        commandLabel={assetAutocomplete.commandLabel}
        onClose={assetAutocomplete.close}
        onHighlightIndex={assetAutocomplete.highlightIndex}
        onToggleCiteKey={assetAutocomplete.toggleSelectedCiteKey}
        onPopupInteractionStart={assetAutocomplete.beginPopupInteraction}
        onPopupInteractionEnd={assetAutocomplete.endPopupInteraction}
        onPick={(item) => {
          const textarea =
            (document.activeElement === previewRef.current && previewRef.current) ||
            (document.activeElement === sourceRef.current && sourceRef.current) ||
            sourceRef.current ||
            previewRef.current;
          assetAutocomplete.applyItem(textarea, item, (value) => {
            if (!textarea) return;
            applyAssetAutocomplete(textarea, value);
          });
        }}
      />
    </div>
  );
}
