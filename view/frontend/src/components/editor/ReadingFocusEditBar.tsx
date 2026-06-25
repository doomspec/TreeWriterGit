import type { RefObject } from "react";

import { cn } from "@/lib/utils";
import { useReadingFocus, useSelectionInScope } from "@/lib/readingFocus";

export function ReadingFocusEditBar({
  title,
  toolbar,
  trailing,
  className,
  editorScopeRef,
  concealUntilSelection = false,
  useInlineToolbar = false,
}: {
  title?: string;
  toolbar: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  /** Editor scroll/content root — selection inside reveals the bar after mouseup/keyup. */
  editorScopeRef?: RefObject<HTMLElement | null>;
  concealUntilSelection?: boolean;
  /** When true, keep the header bar hidden; formatting moves to InlineSelectionToolbar. */
  useInlineToolbar?: boolean;
}) {
  const { active } = useReadingFocus();
  const selectionVisible = useSelectionInScope(
    editorScopeRef ?? { current: null },
    active && concealUntilSelection && !useInlineToolbar,
  );
  const concealed =
    (active && useInlineToolbar) || (active && concealUntilSelection && !selectionVisible);

  return (
    <div
      className={cn(
        "reading-focus-edit-bar shrink-0",
        concealed && "reading-focus-edit-bar--concealed",
        className,
      )}
      role="toolbar"
      aria-label="Focus mode editing"
      aria-hidden={concealed}
    >
      <div className="reading-focus-edit-bar__inner">
        <div className="reading-focus-edit-bar__toolbar">
          {title ? (
            <span className="reading-focus-edit-bar__title ui-label shrink-0 truncate">{title}</span>
          ) : null}
          {toolbar}
        </div>
        {trailing ? <div className="reading-focus-edit-bar__actions">{trailing}</div> : null}
      </div>
    </div>
  );
}
