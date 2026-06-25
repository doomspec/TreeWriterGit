import { createPortal } from "react-dom";
import type { RefObject } from "react";

import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";
import { cn } from "@/lib/utils";
import { useInlineSelectionToolbar } from "@/lib/useInlineSelectionToolbar";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import type { TextHighlightColorId } from "@/lib/textHighlight";

type InlineToolbarProps = {
  renderedMode?: boolean;
  commentsOpen?: boolean;
  unresolvedComments?: number;
  paperPath?: string | null;
  filePath?: string;
  refreshVersion?: number;
  onFormat: (action: MarkdownFormatAction) => void;
  onToggleComments: () => void;
  onInsertInlineNote?: () => void;
  onInsertHighlight?: (color: TextHighlightColorId) => void;
  onInsertSnippet?: (snippet: string) => void;
};

export function InlineSelectionToolbar({
  scopeRef,
  enabled,
  toolbarProps,
  className,
}: {
  scopeRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  toolbarProps: InlineToolbarProps;
  className?: string;
}) {
  const { visible, position, toolbarRef } = useInlineSelectionToolbar(scopeRef, enabled);

  if (!visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={toolbarRef}
      className={cn(
        "inline-selection-toolbar",
        !position && "inline-selection-toolbar--measuring",
        className,
      )}
      style={
        position
          ? { top: position.top, left: position.left }
          : { top: -9999, left: -9999, visibility: "hidden" }
      }
      role="toolbar"
      aria-label="Inline formatting"
      data-editor-floating-chrome
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          event.preventDefault();
        }
      }}
    >
      <MarkdownToolbar embedded inline {...toolbarProps} />
    </div>,
    document.body,
  );
}
