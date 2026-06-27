import { BookOpen, Minimize2 } from "lucide-react";

import { EditorUndoRedoButtons } from "@/components/editor/EditorUndoRedoButtons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReadingFocusFloatingBar({
  wordCount,
  charCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExit,
  className,
}: {
  wordCount: number;
  charCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExit: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm",
        className,
      )}
      role="toolbar"
      aria-label="Reading focus controls"
    >
      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="hidden text-[10px] text-muted-foreground sm:inline">Focus</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {wordCount}w · {charCount}c
      </span>
      <div className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <EditorUndoRedoButtons
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        size="icon"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Exit reading focus (Esc)"
        aria-label="Exit reading focus"
        onClick={onExit}
      >
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
