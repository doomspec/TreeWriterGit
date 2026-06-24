import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssetAutocompletePopup } from "@/components/editor/AssetAutocompletePopup";
import { BlockMarkdownEditor, type BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";
import { PendingApprovalChip } from "@/components/editor/PendingApprovalChip";
import { EditorFocusToggle } from "@/components/editor/EditorFocusToggle";
import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";
import { EditorPaneOverflowMenu } from "@/components/editor/EditorPaneOverflowMenu";
import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { ReadingFocusEditBar } from "@/components/editor/ReadingFocusEditBar";
import { ReadingFocusFloatingBar } from "@/components/editor/ReadingFocusFloatingBar";
import { ReadingFocusDocumentLayout } from "@/components/editor/ReadingFocusDocumentLayout";
import { ReadingFocusTitleLink } from "@/components/editor/ReadingFocusTitleLink";
import { useSyncDocumentOutline } from "@/lib/documentOutline";
import { applyMarkdownFormat, type MarkdownFormatAction } from "@/lib/markdownFormat";
import { handleFormatShortcut } from "@/lib/editor/formatShortcut";
import { draftSaveMeta, draftStatusLabel, loadDraftApprovalState, type DraftEditMeta } from "@/lib/draftApproval";
import { effectiveDiffBaseline } from "@/lib/draftDiff";
import { handleEditorUndoRedoShortcuts } from "@/lib/editorUndoShortcuts";
import { markdownWordCount } from "@/lib/editorStats";
import { authorNoteMacro, wrapInlineNote } from "@/lib/inlineNotes";
import { applyTextHighlight, restoreTextHighlightsFromMarkdown, type TextHighlightColorId } from "@/lib/textHighlight";
import { handleListEnterKeyDown } from "@/lib/listAutocomplete";
import { normalizeComposedDraftBody, normalizeComposedSectionDraft } from "@/lib/sectionCompose";
import { paperPathFromModelPath } from "@/lib/assetInsert";
import { useAssetAutocomplete } from "@/lib/useAssetAutocomplete";
import { TextZoomControl } from "@/components/editor/TextZoomControl";
import { editorTextZoomStyle } from "@/lib/editorTextZoom";
import { useEditorTextZoom } from "@/lib/useEditorTextZoom";
import { useEditorHistory } from "@/lib/useEditorHistory";
import { useReadingFocus } from "@/lib/readingFocus";
import { useDraftAutosave } from "@/lib/useDraftAutosave";
import { useEditorDraftPendingPaths } from "@/lib/draftPendingStore";
import { useEditorDirty } from "@/lib/editorDirtyRegistry";
import { sessionKeyForComposedDraft, loadEditorSession, type EditorPaneMode } from "@/lib/editorSessionState";
import { usePersistedEditorSession } from "@/lib/usePersistedEditorSession";
import { useEditorPresence } from "@/lib/hooks/useEditorPresence";
import { getUserName } from "@/lib/userIdentity";
import { cn } from "@/lib/utils";
import {
  fetchApprovedSectionCompose,
  fetchComments,
  syncSectionDraft,
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
  showFocusGraph = true,
  syncDocumentOutline = false,
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
  subtitle?: string;
  headerExtra?: React.ReactNode;
  /** Inline bulk-approve chip for pending child unit drafts/outlines. */
  childrenApprovalExtra?: React.ReactNode;
  className?: string;
  showFocusGraph?: boolean;
  /** When true, feeds this editor's markdown into the sidebar document outline. */
  syncDocumentOutline?: boolean;
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
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const [selectedLine, setSelectedLine] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const blockRef = useRef<BlockMarkdownEditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const outlineMarkdown = useMemo(() => buildDraftMarkdown(title, content), [title, content]);
  const bindOutlineScroll = useSyncDocumentOutline(
    outlineMarkdown,
    scrollContainerRef,
    syncDocumentOutline && paneMode !== "raw",
  );
  const editorSessionKey = sessionKeyForComposedDraft(containerPath);
  const { restore, persist } = usePersistedEditorSession(editorSessionKey);
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
    saveState,
    isDirty,
    isPendingApproval,
    sessionApprovalActive,
    pendingSource,
    setPendingSource,
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
    onApproved: async () => {
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
    },
    onDiscarded: (restored) => {
      resetHistory(restored);
      setLoadedContent(restored);
    },
  });

  isDirtyRef.current = isDirty;
  useEditorDirty(isDirty);
  const lineCount = useMemo(() => Math.max(24, content.split("\n").length + 2), [content]);
  const draftFilePath = `${containerPath}/draft.md`;
  const { otherEditor } = useEditorPresence(draftFilePath, authorName);
  const paperPath = paperPathFromModelPath(draftFilePath);
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

  const approvalBar = sessionApprovalActive ? (
    <DraftApprovalBar
      pendingSource={pendingSource}
      editedBy={githubHandle || editMeta.editedBy}
      aiAssisted={pendingSource === "ai" || editMeta.aiAssisted}
      onApprove={() => void handleApprove()}
      onDiscard={() => void handleDiscard()}
      approving={saveState === "saving"}
      approveLabel="Approve & sync"
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
    const el = textareaRef.current;
    if (!el) return;
    setSelectedLine(el.value.slice(0, el.selectionStart).split("\n").length);
    persistEditorSession();
  }, [persistEditorSession]);

  const insertAtSelection = useCallback(
    (nextValue: string, cursor: number) => {
      setContent(nextValue);
      requestAnimationFrame(() => {
        const target = textareaRef.current;
        if (!target) return;
        target.focus();
        target.setSelectionRange(cursor, cursor);
        updateSelectedLine();
      });
    },
    [setContent, updateSelectedLine],
  );

  const applyFormat = useCallback(
    (action: MarkdownFormatAction) => {
      if (
        paneMode === "rendered" &&
        blockRef.current?.applyToActiveBlock((value, start, end) =>
          applyMarkdownFormat(value, start, end, action),
        )
      ) {
        return;
      }
      const target = textareaRef.current;
      if (!target) return;
      const result = applyMarkdownFormat(
        target.value,
        target.selectionStart,
        target.selectionEnd,
        action,
      );
      insertAtSelection(result.value, result.selectionStart);
    },
    [insertAtSelection, paneMode],
  );

  const insertInlineNote = useCallback(() => {
    const target = textareaRef.current;
    if (!target) return;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selected = target.value.slice(start, end);
    const note = wrapInlineNote(authorNoteMacro(getUserName()), selected);
    insertAtSelection(`${target.value.slice(0, start)}${note}${target.value.slice(end)}`, start + note.length);
  }, [insertAtSelection]);

  const insertTextHighlight = useCallback(
    (colorId: TextHighlightColorId) => {
      if (paneMode === "rendered") {
        const transform = (value: string, start: number, end: number) =>
          applyTextHighlight(value, start, end, colorId);
        if (blockRef.current?.applyToRenderedSelection(transform)) return;
        if (blockRef.current?.applyToActiveBlock(transform)) return;
        return;
      }

      const target = textareaRef.current;
      if (!target) return;
      const result = applyTextHighlight(
        target.value,
        target.selectionStart,
        target.selectionEnd,
        colorId,
      );
      insertAtSelection(result.value, result.selectionEnd);
    },
    [insertAtSelection, paneMode],
  );

  const insertSnippet = useCallback(
    (snippet: string) => {
      if (paneMode === "rendered" && blockRef.current?.insertSnippet(snippet)) {
        return;
      }
      const target = textareaRef.current;
      if (!target) return;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      insertAtSelection(`${target.value.slice(0, start)}${snippet}${target.value.slice(end)}`, start + snippet.length);
    },
    [insertAtSelection, paneMode],
  );

  useEffect(() => {
    let cancelled = false;
    fetchComments(draftFilePath)
      .then(({ comments }) => {
        if (!cancelled) {
          setUnresolvedComments(comments.filter((c) => !c.resolved).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draftFilePath, refreshVersion]);

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

  const focusEditBar = readingFocus.active ? (
    <ReadingFocusEditBar
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
        <>
          {paneModeToggle}
          {headerExtra}
        </>
      }
    />
  ) : null;

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        commentsOpen && "relative overflow-hidden",
        className,
      )}
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
      {!readingFocus.active ? (
        <div className="ui-pane-header shrink-0">
          <div className="ui-pane-header__label flex max-w-[7rem] shrink-0 items-center gap-1.5 sm:max-w-[9rem]">
            <span className="ui-label truncate">{paneLabel}</span>
            {subtitle ? (
              <span className="hidden truncate text-[10px] text-muted-foreground xl:inline">{subtitle}</span>
            ) : null}
          </div>
          <div className="ui-pane-header__toolbar-slot min-w-0 flex-1 overflow-hidden">
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
          </div>
          <div className="ui-pane-header__actions flex shrink-0 items-center gap-1">
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
          </div>
        </div>
      ) : null}

      {focusEditBar}

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
                showGraph={showFocusGraph}
                title={
                  title.trim() ? (
                    <ReadingFocusTitleLink
                      title={title}
                      contextPath={linkContextPath || containerPath}
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
                  highlightPending={showInlinePendingHighlights}
                  pendingApproval={
                    showInlinePendingHighlights
                      ? {
                          pendingSource: pendingSource ?? "human",
                          editedBy: githubHandle || editMeta.editedBy,
                          aiAssisted: pendingSource === "ai" || editMeta.aiAssisted,
                          aiProvider: editMeta.aiProvider,
                          loadedContent,
                          onApprove: () => void handleApprove(),
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
                  onApprove={() => void handleApprove()}
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
          <button
            type="button"
            className="absolute inset-0 z-10 bg-overlay/40 backdrop-blur-[1px]"
            aria-label="Close comments"
            onClick={() => setCommentsOpen(false)}
          />
          <CommentsPanel
            filePath={draftFilePath}
            paneLabel={paneLabel}
            refreshVersion={refreshVersion}
            selectedLine={selectedLine}
            overlay
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
          assetAutocomplete.applyItem(textareaRef.current, item, (value) => {
            setContent(value);
          });
        }}
      />
    </div>
  );
}
