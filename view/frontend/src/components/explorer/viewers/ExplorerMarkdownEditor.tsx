import { useCallback, useEffect, useRef, useState } from "react";

import { EditorLayoutToggle } from "@/components/editor/EditorLayoutToggle";
import type { BlockMarkdownEditorHandle } from "@/components/editor/editorHandle";
import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { ProseMirrorMarkdownField } from "@/components/editor/ProseMirrorMarkdownField";
import { ReadingFocusDocumentLayout } from "@/components/editor/ReadingFocusDocumentLayout";
import { ReadingFocusEditBar } from "@/components/editor/ReadingFocusEditBar";
import type { EditorLayout } from "@/lib/editor/layout";
import { useFileDocumentEditor } from "@/lib/hooks/useFileDocumentEditor";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

const SAVE_LABEL: Record<string, string> = {
  idle: "Saved",
  dirty: "Unsaved…",
  saving: "Saving…",
  saved: "Saved",
  error: "Error",
};

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * Rich markdown editor for Explorer files: same toolbar + editable preview as
 * Writer mode, but with no draft-approval workflow — plain files, not manuscript
 * drafts, so nothing here needs a pending-diff/approval chip.
 */
export function ExplorerMarkdownEditor({
  path,
  onError,
  onSavingChange,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const readingFocus = useReadingFocus();
  const [layout, setLayout] = useState<EditorLayout>("preview");
  const [activeActions, setActiveActions] = useState<ReadonlySet<string>>(new Set());
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewBlockRef = useRef<BlockMarkdownEditorHandle | null>(null);
  const previewScopeRef = useRef<HTMLDivElement | null>(null);

  const editor = useFileDocumentEditor({
    filePath: path,
    refreshVersion: 0,
    requiresApproval: false,
    onError,
  });

  useEffect(() => {
    onSavingChange?.(editor.saveState === "saving");
  }, [editor.saveState, onSavingChange]);

  const handleFormat = useCallback(
    (action: MarkdownFormatAction) => {
      const sourceFocused = document.activeElement === sourceRef.current;
      if (!sourceFocused && previewBlockRef.current?.runFormat?.(action)) return;
      editor.applyFormat(action, sourceRef.current);
    },
    [editor],
  );

  const showSource = layout === "source" || layout === "split";
  const showPreview = layout === "preview" || layout === "split";
  const fileLabel = basename(path);
  const saveLabel = SAVE_LABEL[editor.saveState] ?? "Saved";

  const layoutToggle = (
    <EditorLayoutToggle layout={layout} onLayoutChange={setLayout} />
  );

  const toolbar = (
    <MarkdownToolbar hideComments onFormat={handleFormat} activeActions={activeActions} embedded />
  );

  if (editor.loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {editor.loadError}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-reading editor-text-zoom-root">
      {readingFocus.active ? (
        <ReadingFocusEditBar
          title={fileLabel}
          toolbar={toolbar}
          trailing={
            <>
              <span className="shrink-0 text-[10px] text-muted-foreground">{saveLabel}</span>
              {layoutToggle}
            </>
          }
          editorScopeRef={previewScopeRef}
          concealUntilSelection={showPreview}
        />
      ) : (
        <div className="flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-center gap-1 border-b border-border bg-card px-2">
          <span className="min-w-0 max-w-[16rem] truncate text-[11px] text-muted-foreground" title={path}>
            {path}
          </span>
          {toolbar}
          <span className="flex-1" />
          <span className="shrink-0 text-[10px] text-muted-foreground">{saveLabel}</span>
          {layoutToggle}
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1">
        {showSource ? (
          <textarea
            ref={sourceRef}
            className={cn(
              "min-h-0 min-w-0 flex-1 resize-none border-0 bg-background p-3 font-mono text-[13px] leading-relaxed outline-none",
              showPreview && "border-r border-border",
              readingFocus.active && showPreview && "editor-chrome-hidden",
            )}
            value={editor.content}
            onChange={(event) => editor.setContent(event.target.value)}
            spellCheck={false}
            aria-label="Raw markdown source"
          />
        ) : null}
        {showPreview ? (
          <div
            ref={previewScopeRef}
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-auto",
              readingFocus.active
                ? "reading-focus-pane markdown-preview-edit px-6 py-5"
                : "p-3",
            )}
          >
            <ReadingFocusDocumentLayout>
              <ProseMirrorMarkdownField
                className="min-h-0 w-full"
                value={editor.content}
                onChange={editor.setContent}
                editorRef={previewBlockRef}
                onActiveFormatsChange={(actions) => setActiveActions(new Set(actions))}
                ariaLabel="Editable markdown preview"
              />
            </ReadingFocusDocumentLayout>
          </div>
        ) : null}
      </div>
    </div>
  );
}
