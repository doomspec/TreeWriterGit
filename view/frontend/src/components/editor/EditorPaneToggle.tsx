import {
  applyEditorPanePreset,
  availableEditorPanePresets,
  matchingEditorPanePreset,
  type EditorPanePresetId,
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

const PRESET_LABELS: Record<EditorPanePresetId, string> = {
  split: "Split",
  write: "Write",
  plan: "Plan",
  notes: "Notes",
};

const PRESET_CHIP_IDS: EditorPanePresetId[] = ["plan", "split", "write"];

export function EditorPaneToggle({
  visiblePanes,
  onVisiblePanesChange,
  activePane,
  onActivePaneChange,
  showNotes = true,
  className,
}: EditorPaneToggleProps) {
  const handlePresetClick = (presetId: EditorPanePresetId) => {
    const next = applyEditorPanePreset(presetId, showNotes);
    onVisiblePanesChange(next.visible);
    onActivePaneChange(next.active);
  };

  const activePreset = matchingEditorPanePreset(visiblePanes, activePane, showNotes);
  const chips = PRESET_CHIP_IDS.filter((id) => availableEditorPanePresets(showNotes).includes(id));

  return (
    <div
      className={cn("editor-pane-toggle editor-pane-toggle--presets-only", className)}
      role="group"
      aria-label="Editor layout presets"
      title="Switch between Split (outline + draft), Write (draft + notes), and Plan (outline only)."
    >
      {chips.map((presetId) => (
        <button
          key={presetId}
          type="button"
          className={cn(
            "editor-pane-toggle__preset",
            activePreset === presetId && "editor-pane-toggle__preset--active",
          )}
          aria-pressed={activePreset === presetId}
          onClick={() => handlePresetClick(presetId)}
        >
          {PRESET_LABELS[presetId]}
        </button>
      ))}
    </div>
  );
}

export function EditorPaneToggleHost(props: EditorPaneToggleProps) {
  return <EditorPaneToggle {...props} />;
}
