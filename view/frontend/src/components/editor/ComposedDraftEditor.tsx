import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BlockMarkdownEditor, type BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import {
  EditorAssetAutocompleteLayer,
  EditorCommentsOverlay,
  EditorShell,
} from "@/components/editor/EditorShell";
import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { MultiParagraphApprovalDialog } from "@/components/editor/MultiParagraphApprovalDialog";
import { PendingApprovalChip } from "@/components/editor/PendingApprovalChip";
import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";
import { EditorPaneOverflowMenu } from "@/components/editor/EditorPaneOverflowMenu";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { InlineSelectionToolbar } from "@/components/editor/InlineSelectionToolbar";
import { ReadingFocusEditBar } from "@/components/editor/ReadingFocusEditBar";
import { ReadingFocusFloatingBar } from "@/components/editor/ReadingFocusFloatingBar";
import { ReadingFocusDocumentLayout } from "@/components/editor/ReadingFocusDocumentLayout";
import { ReadingFocusTitleLink } from "@/components/editor/ReadingFocusTitleLink";
import { usePendingChangeNavigation } from "@/lib/usePendingChangeNavigation";
import { useSyncDocumentOutline } from "@/lib/documentOutline";
import { headingIdFromLine } from "@/lib/markdownOutline";
import { useRenderedOrTextareaFormat } from "@/lib/useRenderedOrTextareaFormat";
import { handleFormatShortcut } from "@/lib/editor/formatShortcut";
import { draftSaveMeta, draftStatusLabel, loadDraftApprovalState, approveDraftAtPath, type DraftEditMeta } from "@/lib/draftApproval";
import { effectiveDiffBaseline } from "@/lib/draftDiff";
import { handleEditorUndoRedoShortcuts } from "@/lib/editorUndoShortcuts";
import { markdownWordCount } from "@/lib/editorStats";
import { restoreTextHighlightsFromMarkdown, type TextHighlightColorId } from "@/lib/textHighlight";
import { handleListEnterKeyDown } from "@/lib/listAutocomplete";
import { normalizeComposedDraftBody, normalizeComposedSectionDraft } from "@/lib/sectionCompose";
import {
  buildLinkedHeadingMarkdown,
  childFolderSlugsFromComposedBody,
  combineMultiParagraphUnits,
  findMultiParagraphUnits,
  insertMarkdownAfterBlock,
  splitMultiParagraphUnits,
  titleCaseFromSlug,
} from "@/lib/composedDraftStructure";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { paperPathFromModelPath } from "@/lib/assetInsert";
import { useEditorCrossRef } from "@/lib/hooks/useEditorCrossRef";
import { useEditorComments } from "@/lib/hooks/useEditorComments";
import { useDocumentEditor } from "@/lib/hooks/useDocumentEditor";
import { useAssetAutocomplete } from "@/lib/useAssetAutocomplete";
import { TextZoomControl } from "@/components/editor/TextZoomControl";
import { editorTextZoomStyle } from "@/lib/editorTextZoom";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";
import { useReadingFocus } from "@/lib/readingFocus";
import { useEditorDraftPendingPaths } from "@/lib/draftPendingStore";
import { sessionKeyForComposedDraft, loadEditorSession, type EditorPaneMode } from "@/lib/editorSessionState";
import { useEditorPresence } from "@/lib/hooks/useEditorPresence";
import { getUserName } from "@/lib/userIdentity";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { parentPath } from "@/lib/modelTree";
import { cn } from "@/lib/utils";
import {
  fetchApprovedSectionCompose,
  syncSectionDraft,
  createNode,
  reorderChildren,
} from "@/modelApi";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

function buildDraftMarkdown(title: string, body: string): string {
  return title.trim() ? `# ${title.trim()}\n\n${body.trimEnd()}\n` : `${body.trimEnd()}\n`;
}

export function ComposedDraftEditor({
  containerPath,
  title,
  markdown,
  approvedDraftMarkdown,
  pendingAiProvider = null,
  refreshVersion,
  linkContextPath,
  onNavigate,
  onError,
  onSynced,
  paneLabel = "Draft",
  subtitle,
  headerExtra,
  childrenApprovalExtra,
  className,
  syncDocumentOutline = false,
  splitPaneTitle,
  showReadingFocusBar = true,
}: {
  containerPath: string;
  title: string;
  markdown: string;
  /** Approved composed draft from parent compose fetch — avoids duplicate section-compose calls. */
  approvedDraftMarkdown?: string;
  /** AI provider for pending child-unit edits (from section compose). */
  pendingAiProvider?: string | null;
  refreshVersion: number;
  linkContextPath: string;
  onNavigate: (target: NavigateTarget) => void;
  onError: (message: string) => void;
  onSynced?: () => void;
  paneLabel?: string;
  /** Short label shown in the focus edit bar when both panes are visible. */
  splitPaneTitle?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  /** Inline bulk-approve chip for pending child unit drafts/outlines. */
  childrenApprovalExtra?: React.ReactNode;
  className?: string;
  /** When true, feeds this editor's markdown into the sidebar document outline. */
  syncDocumentOutline?: boolean;
  /** When false, hides the reading-focus floating bar (multi-pane workspaces pass active pane). */
  showReadingFocusBar?: boolean;
}) {
  const readingFocus = useReadingFocus();
  const nav = useWorkspaceNavigationContext();
  const effectiveLinkContext = linkContextPath || containerPath;
  const activeOutlineNavPath = useMemo(() => {
    const focus = nav.activeFile ? parentPath(nav.activeFile) : nav.browsePath;
    const context = effectiveLinkContext.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedFocus = focus.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!normalizedFocus || normalizedFocus === context) return null;
    return normalizedFocus;
  }, [containerPath, effectiveLinkContext, nav.activeFile, nav.browsePath]);
  const paperPath = useMemo(
    () => paperPathFromModelPath(linkContextPath || containerPath),
    [containerPath, linkContextPath],
  );
  const figureLabelIndex = useEditorCrossRef(paperPath, refreshVersion);

  const [loadedContent, setLoadedContent] = useState("");
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [editMeta, setEditMeta] = useState<DraftEditMeta>({
    editedBy: null,
    editedAt: null,
    aiAssisted: false,
    aiProvider: null,
    approvedBy: null,
    approvedAt: null,
  });
  const [paneMode, setPaneMode] = useState<EditorPaneMode>(() => {
    const saved = loadEditorSession(sessionKeyForComposedDraft(containerPath));
    const mode = saved?.paneMode ?? "rendered";
    if (mode === "raw") return "raw";
    if (mode === "changes") return "rendered";
    return "rendered";
  });
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState(1);
  const [structureInsert, setStructureInsert] = useState<{
    kind: "unit" | "section";
    blockIndex: number;
  } | null>(null);
  const [multiParagraphPrompt, setMultiParagraphPrompt] = useState(false);
  const [structureBusy, setStructureBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const blockRef = useRef<BlockMarkdownEditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const editorSessionKey = sessionKeyForComposedDraft(containerPath);
  const isDirtyRef = useRef(false);
  const authorName = useMemo(() => getUserName(), []);
  const { zoom, zoomIn, zoomOut, resetZoom } = useEditorTextZoom();
  const textZoomStyle = editorTextZoomStyle(zoom);

  const saveContent = useCallback(
    async (body: string, pendingSource: "human" | "ai" | null) => {
      const normalized = normalizeComposedDraftBody(body, title);
      await syncSectionDraft(
        containerPath,
        buildDraftMarkdown(title, normalized),
        draftSaveMeta(pendingSource),
      );
    },
    [containerPath, title],
  );

  const reloadAfterDiscard = useCallback(async () => {
    const { draftMarkdown } = await fetchApprovedSectionCompose(containerPath);
    return normalizeComposedSectionDraft(title, draftMarkdown);
  }, [containerPath, title]);

  const {
    content,
    setContent,
    resetHistory,
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
    setSaveState,
    handleDiscard,
    restore,
    persist,
  } = useDocumentEditor({
    sessionKey: editorSessionKey,
    targetPath: containerPath,
    loadedContent,
    setLoadedContent,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard,
    onError,
    onSaved: onSynced,
    onDiscarded: (restored) => {
      setLoadedContent(restored);
    },
  });

  const afterApproved = useCallback(async () => {
    try {
      const { draftMarkdown } = await fetchApprovedSectionCompose(containerPath);
      const normalized = normalizeComposedSectionDraft(title, draftMarkdown);
      resetHistory(normalized);
      setLoadedContent(normalized);
      setApprovedBaseline(normalized);
    } catch {
      const fallback = normalizeComposedDraftBody(content, title);
      resetHistory(fallback);
      setLoadedContent(fallback);
      setApprovedBaseline(fallback);
    }
    onSynced?.();
  }, [containerPath, content, onSynced, resetHistory, setApprovedBaseline, setLoadedContent, title]);

  const completeApprove = useCallback(
    async (body: string) => {
      const normalized = normalizeComposedDraftBody(body, title);
      setSaveState("saving");
      try {
        if (normalized !== loadedContent) {
          await saveContent(normalized, pendingSource);
        }
        await approveDraftAtPath(containerPath, githubHandle || null);
        setContent(normalized);
        setLoadedContent(normalized);
        setApprovedBaseline(normalized);
        setPendingSource(null);
        setSaveState("saved");
        await afterApproved();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
        setSaveState("error");
      }
    },
    [
      afterApproved,
      containerPath,
      githubHandle,
      loadedContent,
      onError,
      pendingSource,
      saveContent,
      setApprovedBaseline,
      setContent,
      setLoadedContent,
      setPendingSource,
      setSaveState,
      title,
    ],
  );

  const editorStats = useMemo(() => markdownWordCount(content), [content]);
  const outlineMarkdown = useMemo(() => buildDraftMarkdown(title, content), [title, content]);
  const documentTitleHeadingId = useMemo(
    () => (title.trim() ? headingIdFromLine(`# ${title.trim()}`, new Map()) : null),
    [title],
  );
  const bindOutlineScroll = useSyncDocumentOutline(
    outlineMarkdown,
    scrollContainerRef,
    syncDocumentOutline && paneMode !== "raw",
    linkContextPath,
  );
  isDirtyRef.current = isDirty;
  const lineCount = useMemo(() => Math.max(24, content.split("\n").length + 2), [content]);
  const draftFilePath = `${containerPath}/draft.md`;
  const { unresolvedComments, setUnresolvedComments } = useEditorComments(
    draftFilePath,
    refreshVersion,
  );
  const { otherEditor } = useEditorPresence(draftFilePath, authorName);
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
  const editorDraftPendingPaths = useEditorDraftPendingPaths();
  const outlinePath = `${containerPath}/outline.md`;
  const outlinePendingElsewhere = useMemo(
    () => !sessionApprovalActive && editorDraftPendingPaths.has(outlinePath),
    [editorDraftPendingPaths, outlinePath, sessionApprovalActive],
  );

  const getScrollElement = useCallback(
    (): HTMLElement | null => scrollContainerRef.current,
    [],
  );

  const pendingChangeNavigation = usePendingChangeNavigation(
    getScrollElement,
    showInlinePendingHighlights,
    `${content.length}:${paneMode}`,
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

  const runApprove = useCallback(async () => {
    if (findMultiParagraphUnits(content).length > 0) {
      setMultiParagraphPrompt(true);
      return;
    }
    await completeApprove(content);
  }, [completeApprove, content]);

  const resolveMultiParagraph = useCallback(
    async (mode: "split" | "combine") => {
      setStructureBusy(true);
      try {
        let next = content;
        if (mode === "combine") {
          next = combineMultiParagraphUnits(content);
        } else {
          next = await splitMultiParagraphUnits(content, async (slug) => {
            await createNode(containerPath, slug, "unit");
          });
          await nav.reloadModel();
          const order = childFolderSlugsFromComposedBody(next);
          if (order.length > 0) {
            await reorderChildren(containerPath, order);
          }
        }
        setMultiParagraphPrompt(false);
        await completeApprove(next);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setStructureBusy(false);
      }
    },
    [completeApprove, containerPath, content, nav, onError],
  );

  const composedDraftActions = useMemo(
    () => ({
      onAddUnitAfter: (_blockId: string, blockIndex: number) => {
        setStructureInsert({ kind: "unit", blockIndex });
      },
      onAddSubsectionAfter: (_blockId: string, blockIndex: number) => {
        setStructureInsert({ kind: "section", blockIndex });
      },
    }),
    [],
  );

  const confirmStructureInsert = useCallback(
    async (slug: string) => {
      if (!structureInsert) return;
      setStructureBusy(true);
      try {
        const nodeKind = structureInsert.kind === "unit" ? "unit" : "section";
        await createNode(containerPath, slug, nodeKind);
        const heading = buildLinkedHeadingMarkdown(slug, titleCaseFromSlug(slug));
        const next = insertMarkdownAfterBlock(content, structureInsert.blockIndex, [heading, ""]);
        setContent(next);
        const order = childFolderSlugsFromComposedBody(next);
        if (order.length > 0) {
          await reorderChildren(containerPath, order);
        }
        await nav.reloadModel();
        onSynced?.();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setStructureBusy(false);
        setStructureInsert(null);
      }
    },
    [containerPath, content, nav, onError, onSynced, structureInsert],
  );

  const approvalBar = sessionApprovalActive ? (
    <DraftApprovalBar
      pendingSource={pendingSource}
      editedBy={githubHandle || editMeta.editedBy}
      aiAssisted={pendingSource === "ai" || editMeta.aiAssisted}
      onApprove={() => void runApprove()}
      onDiscard={() => void handleDiscard()}
      approving={saveState === "saving"}
      approveLabel="Approve & sync"
      changeNavigation={pendingChangeNavigation}
    />
  ) : null;

  useEffect(() => {
    if (!isPendingApproval) return;
    let cancelled = false;
    void loadDraftApprovalState(draftFilePath).then(({ meta }) => {
      if (cancelled) return;
      setEditMeta({
        ...meta,
        aiProvider: meta.aiProvider ?? pendingAiProvider ?? null,
        aiAssisted: meta.aiAssisted || Boolean(pendingAiProvider),
      });
      if (meta.aiAssisted || pendingAiProvider) {
        setPendingSource((prev) => (prev === "human" ? prev : "ai"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftFilePath, isPendingApproval, pendingAiProvider, refreshVersion, setPendingSource]);

  useEffect(() => {
    const saved = loadEditorSession(sessionKeyForComposedDraft(containerPath));
    setPaneMode(saved?.paneMode ?? "rendered");
  }, [containerPath]);

  const persistEditorSession = useCallback(() => {
    persist(textareaRef.current, scrollContainerRef.current, paneMode);
  }, [paneMode, persist]);

  useEffect(() => {
    if (!loadedContent) return;
    restore(textareaRef.current, scrollContainerRef.current, setPaneMode);
  }, [containerPath, loadedContent, restore]);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
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
  }, [containerPath, paneMode, persistEditorSession]);

  const updateSelectedLine = useCallback(() => {
    if (paneMode === "rendered" && blockRef.current) {
      const line = blockRef.current.getCursorLineNumber();
      if (line != null) {
        setSelectedLine(line);
        persistEditorSession();
        return;
      }
    }
    const el = textareaRef.current;
    if (!el) return;
    setSelectedLine(el.value.slice(0, el.selectionStart).split("\n").length);
    persistEditorSession();
  }, [paneMode, persistEditorSession]);

  const onTextareaEdit = useCallback(
    (value: string, selectionStart: number, selectionEnd?: number) => {
      setContent(value);
      requestAnimationFrame(() => {
        const target = textareaRef.current;
        if (!target) return;
        target.focus();
        target.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
        updateSelectedLine();
      });
    },
    [setContent, updateSelectedLine],
  );

  const { applyFormat, insertInlineNote, insertTextHighlight, insertSnippet } =
    useRenderedOrTextareaFormat({
      blockRef,
      textareaRef,
      renderedActive: paneMode === "rendered",
      onTextareaEdit,
    });

  const assetAutocomplete = useAssetAutocomplete({
    paperPath,
    filePath: draftFilePath,
    refreshVersion,
    enabled: Boolean(paperPath),
  });

  const applyAssetAutocomplete = useCallback((_textarea: HTMLTextAreaElement, value: string) => {
    setContent(value);
  }, []);

  const onRawKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (handleEditorUndoRedoShortcuts(event, { undo, redo })) return;

      if (
        assetAutocomplete.handleKeyDown(event, (value) => {
          applyAssetAutocomplete(event.currentTarget, value);
        })
      ) {
        return;
      }

      const target = event.currentTarget;
      if (
        handleListEnterKeyDown({
          event,
          value: target.value,
          selectionStart: target.selectionStart,
          selectionEnd: target.selectionEnd,
          apply: (result) => {
            setContent(result.value);
            requestAnimationFrame(() => {
              target.focus();
              target.setSelectionRange(result.selectionStart, result.selectionEnd);
            });
          },
        })
      ) {
        return;
      }

      handleFormatShortcut(event, applyFormat);
    },
    [applyAssetAutocomplete, applyFormat, assetAutocomplete, redo, undo],
  );

  const onBlockKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (handleEditorUndoRedoShortcuts(event, { undo, redo })) return;

      const mirror = textareaRef.current;
      if (!mirror) return;

      if (
        assetAutocomplete.handleKeyDown(
          event as unknown as React.KeyboardEvent<HTMLTextAreaElement>,
          (value) => {
            applyAssetAutocomplete(mirror, value);
          },
        )
      ) {
        return;
      }

      handleFormatShortcut(event, applyFormat);
    },
    [applyAssetAutocomplete, assetAutocomplete, applyFormat, redo, undo],
  );

  useEffect(() => {
    const live = normalizeComposedSectionDraft(title, markdown);
    const approved =
      approvedDraftMarkdown !== undefined
        ? normalizeComposedSectionDraft(title, approvedDraftMarkdown)
        : live;

    const allUnitsApproved = live === approved;
    const locallySynced =
      !isDirtyRef.current && content === loadedContent && content.length > 0;
    const locallyApproved = locallySynced && content === approvedBaseline;
    const parentComposeStale = locallySynced && content !== live;

    // After approve (or autosave), parent compose may lag behind local state.
    if ((locallyApproved && !allUnitsApproved) || parentComposeStale) {
      return;
    }

    if (allUnitsApproved) {
      setApprovedBaseline(approved);
      if (content !== live || loadedContent !== live) {
        resetHistory(live);
        setLoadedContent(live);
      }
      return;
    }

    if (isDirtyRef.current) return;

    setApprovedBaseline(approved);
    resetHistory(live);
    setLoadedContent(live);
  }, [
    approvedDraftMarkdown,
    content,
    loadedContent,
    markdown,
    refreshVersion,
    resetHistory,
    title,
  ]);

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

  const paneModeToggle = (
    <EditorPaneModeToggle
      paneMode={paneMode}
      onPaneModeChange={setPaneMode}
      ariaLabel={`${paneLabel} editing mode`}
      reviewMode={showInlinePendingHighlights && paneMode === "rendered"}
    />
  );

  const paneEditBar = (
    <ReadingFocusEditBar
      title={splitPaneTitle ?? paneLabel}
      editorScopeRef={scrollContainerRef}
      concealUntilSelection={readingFocus.active}
      useInlineToolbar={readingFocus.active}
      toolbar={
        <MarkdownToolbar
          embedded
          renderedMode={paneMode === "rendered"}
          commentsOpen={commentsOpen}
          unresolvedComments={unresolvedComments}
          paperPath={paperPath}
          filePath={draftFilePath}
          refreshVersion={refreshVersion}
          onFormat={applyFormat}
          onToggleComments={() => setCommentsOpen((open) => !open)}
          onInsertInlineNote={insertInlineNote}
          onInsertHighlight={insertTextHighlight}
          onInsertSnippet={insertSnippet}
        />
      }
      trailing={
        readingFocus.active ? (
          <>
            {paneModeToggle}
            {headerExtra}
          </>
        ) : (
          <>
            {paneModeToggle}
            <EditorPaneOverflowMenu statusText={!sessionApprovalActive ? saveLabel : undefined}>
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
              <div className="px-1 py-1">
                <TextZoomControl zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
              </div>
              {headerExtra ? <div className="px-1 py-1">{headerExtra}</div> : null}
            </EditorPaneOverflowMenu>
          </>
        )
      }
    />
  );

  return (
    <>
    <EditorShell
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        commentsOpen && "relative overflow-hidden",
        className,
      )}
      comments={
        <EditorCommentsOverlay
          open={commentsOpen}
          filePath={draftFilePath}
          paneLabel={paneLabel}
          refreshVersion={refreshVersion}
          selectedLine={selectedLine}
          overlay
          onClose={() => setCommentsOpen(false)}
          onError={onError}
          onUnresolvedChange={setUnresolvedComments}
          onNavigateToLine={setSelectedLine}
        />
      }
      autocomplete={
        <EditorAssetAutocompleteLayer
          autocomplete={assetAutocomplete}
          onApplyValue={(value) => {
            setContent(value);
          }}
        />
      }
    >
      {otherEditor ? (
        <div
          className={cn(
            "border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100",
            readingFocus.active && "editor-chrome-hidden",
          )}
        >
          Being edited by {otherEditor}
        </div>
      ) : null}
      {paneEditBar}

      {approvalBar}

      {outlinePendingElsewhere ? (
        <div className="border-b border-amber-500/25 bg-amber-500/5 px-4 py-2 text-xs text-amber-950 dark:text-amber-100">
          The <strong>Outline</strong> pane has unapproved changes — switch to Outline to review and approve.
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={bindOutlineScroll}
            className={cn(
              "markdown-pane editor-text-zoom-root min-h-0 flex-1 overflow-auto px-6 py-5",
              readingFocus.active && "reading-focus-pane",
            )}
            style={textZoomStyle}
          >
        {childrenApprovalExtra}
        {content.trim() || paneMode === "raw" ? (
          paneMode === "rendered" ? (
            content.trim() ? (
              <ReadingFocusDocumentLayout
                title={
                  title.trim() ? (
                    <ReadingFocusTitleLink
                      title={title}
                      contextPath={linkContextPath || containerPath}
                      headingId={documentTitleHeadingId}
                      onNavigate={onNavigate}
                    />
                  ) : null
                }
              >
                <BlockMarkdownEditor
                  ref={blockRef}
                  value={content}
                  approvedBaseline={approvedBaseline}
                  loadedContent={loadedContent}
                  figureLabelIndex={figureLabelIndex}
                  highlightPending={showInlinePendingHighlights}
                  pendingApproval={
                    showInlinePendingHighlights
                      ? {
                          pendingSource: pendingSource ?? "human",
                          editedBy: githubHandle || editMeta.editedBy,
                          aiAssisted: pendingSource === "ai" || editMeta.aiAssisted,
                          aiProvider: editMeta.aiProvider,
                          loadedContent,
                          onApprove: () => void runApprove(),
                          onDiscard: () => void handleDiscard(),
                          approving: saveState === "saving",
                          approveLabel: "Approve & sync",
                        }
                      : null
                  }
                  className={cn(
                    "composed-draft-preview",
                    title.trim() && "composed-draft-preview--hide-lead-title",
                  )}
                linkContextPath={linkContextPath}
                activeOutlineNavPath={activeOutlineNavPath}
                linksClickable
                ariaLabel={`Edit composed ${paneLabel.toLowerCase()}`}
                onNavigate={onNavigate}
                refreshVersion={refreshVersion}
                onChange={setContent}
                inputRef={textareaRef}
                onSelect={updateSelectedLine}
                onBlur={(event) => assetAutocomplete.handleEditorBlur(event.currentTarget)}
                onKeyDown={onBlockKeyDown}
                onTextareaSync={(textarea) => void assetAutocomplete.sync(textarea)}
                composedDraftActions={composedDraftActions}
              />
              </ReadingFocusDocumentLayout>
            ) : (
              <p className="text-sm italic text-muted-foreground">Empty composed draft.</p>
            )
          ) : (
            <>
              {showInlinePendingHighlights ? (
                <PendingApprovalChip
                  inline
                  className="mb-2"
                  pendingSource={pendingSource ?? "human"}
                  editedBy={githubHandle || editMeta.editedBy}
                  aiAssisted={pendingSource === "ai" || editMeta.aiAssisted}
                  aiProvider={editMeta.aiProvider}
                  approvedBaseline={approvedBaseline}
                  loadedContent={loadedContent}
                  current={content}
                  onApprove={() => void runApprove()}
                  onDiscard={() => void handleDiscard()}
                  approving={saveState === "saving"}
                  approveLabel="Approve & sync"
                />
              ) : null}
              <HighlightingTextarea
              fillContainer={false}
              inputRef={textareaRef}
              className="composed-draft-raw w-full font-mono text-[13px] leading-6"
              mirrorClassName="font-mono text-[13px] leading-6"
              value={content}
              baseline={diffBaseline}
              highlight={showInlinePendingHighlights}
              rows={lineCount}
              spellCheck={false}
              aria-label={`Edit composed ${paneLabel.toLowerCase()} (raw)`}
              onChange={(event) => {
                setContent(event.target.value);
                void assetAutocomplete.sync(event.currentTarget);
              }}
              onSelect={(event) => {
                updateSelectedLine();
                void assetAutocomplete.sync(event.currentTarget);
              }}
              onKeyUp={(event) => void assetAutocomplete.sync(event.currentTarget)}
              onClick={(event) => {
                handleRawClick(event);
                void assetAutocomplete.sync(event.currentTarget);
              }}
              onFocus={(event) => void assetAutocomplete.sync(event.currentTarget)}
              onBlur={(event) => assetAutocomplete.handleEditorBlur(event.currentTarget)}
              onKeyDown={onRawKeyDown}
            />
            </>
          )
        ) : (
          <p className="text-sm italic text-muted-foreground">Empty composed draft.</p>
        )}
          </div>
          <InlineSelectionToolbar
            scopeRef={scrollContainerRef}
            enabled={readingFocus.active}
            toolbarProps={{
              renderedMode: paneMode === "rendered",
              commentsOpen,
              unresolvedComments,
              paperPath,
              filePath: draftFilePath,
              refreshVersion,
              onFormat: applyFormat,
              onToggleComments: () => setCommentsOpen((open) => !open),
              onInsertInlineNote: insertInlineNote,
              onInsertHighlight: insertTextHighlight,
              onInsertSnippet: insertSnippet,
            }}
          />
          {readingFocus.active && showReadingFocusBar ? (
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
    </EditorShell>
      <NamePromptDialog
        open={structureInsert !== null}
        title={structureInsert?.kind === "section" ? "New subsection" : "New unit"}
        label="Folder name (slug)"
        defaultValue={structureInsert?.kind === "section" ? "new-subsection" : "new-unit"}
        confirmLabel={structureBusy ? "Creating…" : "Create"}
        onConfirm={(name) => void confirmStructureInsert(name)}
        onCancel={() => setStructureInsert(null)}
      />
      <MultiParagraphApprovalDialog
        open={multiParagraphPrompt}
        unitCount={findMultiParagraphUnits(content).length}
        busy={structureBusy}
        onSplitIntoUnits={() => void resolveMultiParagraph("split")}
        onCombineIntoOne={() => void resolveMultiParagraph("combine")}
        onCancel={() => setMultiParagraphPrompt(false)}
      />
    </>
  );
}
