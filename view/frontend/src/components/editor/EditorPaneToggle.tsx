import {
  EDITOR_PANE_IDS,
  countVisibleEditorPanes,
  reconcileActiveEditorPane,
  toggleEditorPane,
  type EditorPaneId,
  type EditorVisiblePanes,
} from "@/lib/editorVisiblePanes";
import type { DualPaneActive } from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

export type EditorPaneToggleProps = {
  visiblePanes: EditorVisiblePanes;
  onVisiblePanesChange: (panes: EditorVisiblePanes) => void;
  activePane: DualPaneActive;
  onActivePaneChange: (pane: DualPaneActive) => void;
  showNotes?: boolean;
  className?: string;
};

const PANE_LABELS: Record<EditorPaneId, string> = {
  outline: "Outline",
  draft: "Draft",
  notes: "Notes",
};

export function EditorPaneToggle({
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  showNotes = true,
  className,
}: EditorPaneToggleProps) {
  const handlePaneClick = (pane: EditorPaneId) => {
    const wasVisible = visiblePanes[pane];
    const next = toggleEditorPane(visiblePanes, pane);
    onVisiblePanesChange(next);
    onActivePaneChange(wasVisible ? reconcileActiveEditorPane(next, activePane) : pane);
  };

  const visibleCount = countVisibleEditorPanes(visiblePanes);
  const panes = EDITOR_PANE_IDS.filter((id) => showNotes || id !== "notes");

  return (
    <div
      className={cn("editor-pane-toggle editor-pane-toggle--presets-only", className)}
      role="group"
      aria-label="Editor panes"
      title="Choose which editor panes are open."
    >
      {panes.map((pane) => {
        const isVisible = visiblePanes[pane];
        const disabled = isVisible && visibleCount === 1;
        return (
          <button
            key={pane}
            type="button"
            className={cn(
              "editor-pane-toggle__preset",
              isVisible && "editor-pane-toggle__preset--active",
            )}
            aria-pressed={isVisible}
            disabled={disabled}
            title={`${isVisible ? "Hide" : "Show"} ${PANE_LABELS[pane].toLowerCase()} pane`}
            onClick={() => handlePaneClick(pane)}
          >
            {PANE_LABELS[pane]}
          </button>
        );
      })}
    </div>
  );
}

export function EditorPaneToggleHost(props: EditorPaneToggleProps) {
  return <EditorPaneToggle {...props} />;
}
