import { Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EditorUndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  size = "sm",
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  size?: "sm" | "icon";
}) {
  const iconClass = size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5";
  const buttonClass = size === "icon" ? "h-7 w-7" : "h-7 px-2";

  return (
    <div className="inline-flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size={size === "icon" ? "icon" : "sm"}
        className={buttonClass}
        title="Undo (⌘Z)"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 className={iconClass} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={size === "icon" ? "icon" : "sm"}
        className={buttonClass}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 className={iconClass} aria-hidden="true" />
      </Button>
    </div>
  );
}
