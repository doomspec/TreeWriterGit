import type { DualPaneActive } from "@/lib/workspacePreferences";

export type EditorPaneId = "outline" | "draft" | "notes";

export type EditorVisiblePanes = Record<EditorPaneId, boolean>;

export const EDITOR_PANE_IDS: EditorPaneId[] = ["outline", "draft", "notes"];

export const DEFAULT_EDITOR_VISIBLE_PANES: EditorVisiblePanes = {
  outline: true,
  draft: true,
  notes: false,
};

/** @deprecated legacy single-pane view; used only when migrating stored prefs. */
export type LegacyDualPaneView = "outline" | "draft" | "notes" | "split";

export type EditorPanePresetId = "split" | "write" | "plan" | "notes";

export const EDITOR_PANE_PRESET_IDS: EditorPanePresetId[] = ["plan", "split", "write", "notes"];

export const EDITOR_PANE_PRESETS: Record<
  EditorPanePresetId,
  { visible: EditorVisiblePanes; active: DualPaneActive }
> = {
  split: {
    visible: { outline: true, draft: true, notes: false },
    active: "draft",
  },
  write: {
    visible: { outline: false, draft: true, notes: true },
    active: "draft",
  },
  plan: {
    visible: { outline: true, draft: false, notes: false },
    active: "outline",
  },
  notes: {
    visible: { outline: false, draft: false, notes: true },
    active: "notes",
  },
};

export function countVisibleEditorPanes(panes: EditorVisiblePanes): number {
  return EDITOR_PANE_IDS.filter((id) => panes[id]).length;
}

export function visibleEditorPaneList(panes: EditorVisiblePanes): EditorPaneId[] {
  return EDITOR_PANE_IDS.filter((id) => panes[id]);
}

export function normalizeEditorVisiblePanes(
  input: Partial<EditorVisiblePanes> | undefined,
): EditorVisiblePanes {
  if (!input) return { ...DEFAULT_EDITOR_VISIBLE_PANES };
  const merged: EditorVisiblePanes = {
    outline: Boolean(input.outline),
    draft: Boolean(input.draft),
    notes: Boolean(input.notes),
  };
  const count = countVisibleEditorPanes(merged);
  if (count === 0) return { ...DEFAULT_EDITOR_VISIBLE_PANES };
  if (count <= 2) return merged;
  return {
    outline: merged.outline,
    draft: merged.draft || merged.notes,
    notes: false,
  };
}

export function migrateLegacyPanePrefs(
  view?: LegacyDualPaneView,
  notesStripOpen?: boolean,
): EditorVisiblePanes {
  if (view === "outline") return { outline: true, draft: false, notes: false };
  if (view === "draft") return { outline: false, draft: true, notes: false };
  if (view === "notes") return { outline: false, draft: false, notes: true };
  if (notesStripOpen) return { outline: false, draft: true, notes: true };
  return { outline: true, draft: true, notes: false };
}

export function toggleEditorPane(
  current: EditorVisiblePanes,
  pane: EditorPaneId,
  activePane?: EditorPaneId,
): EditorVisiblePanes {
  const turningOn = !current[pane];
  let next: EditorVisiblePanes = { ...current, [pane]: turningOn };

  let count = countVisibleEditorPanes(next);
  if (count === 0) {
    return { ...current, [pane]: true };
  }
  if (count <= 2) {
    return next;
  }

  const candidates = EDITOR_PANE_IDS.filter((id) => id !== pane && next[id]);
  const toDisable = activePane
    ? (candidates.find((id) => id !== activePane) ?? candidates[0])
    : candidates[0];
  next = { ...next, [toDisable]: false };
  return next;
}

export function reconcileActiveEditorPane(
  visible: EditorVisiblePanes,
  active: EditorPaneId,
): EditorPaneId {
  if (visible[active]) return active;
  return visibleEditorPaneList(visible)[0] ?? "outline";
}

/** Show + focus a pane without hiding it. */
export function focusEditorPane(
  current: EditorVisiblePanes,
  pane: EditorPaneId,
  activePane: EditorPaneId,
): { visible: EditorVisiblePanes; active: EditorPaneId } {
  if (current[pane]) {
    return { visible: current, active: pane };
  }
  const visible = toggleEditorPane(current, pane, activePane);
  return { visible, active: pane };
}

/** Hide a visible pane when more than one pane is shown. */
export function hideEditorPane(
  current: EditorVisiblePanes,
  pane: EditorPaneId,
  activePane: EditorPaneId,
): { visible: EditorVisiblePanes; active: EditorPaneId } {
  if (!current[pane] || countVisibleEditorPanes(current) <= 1) {
    return { visible: current, active: activePane };
  }
  const visible = { ...current, [pane]: false };
  return {
    visible,
    active: reconcileActiveEditorPane(visible, activePane),
  };
}

/** Focus a visible pane, or toggle visibility when hidden or already focused. */
export function focusOrToggleEditorPane(
  current: EditorVisiblePanes,
  pane: EditorPaneId,
  activePane: EditorPaneId,
): { visible: EditorVisiblePanes; active: EditorPaneId } {
  if (current[pane] && activePane !== pane) {
    return { visible: current, active: pane };
  }
  const turningOn = !current[pane];
  const visible = toggleEditorPane(current, pane, activePane);
  return {
    visible,
    active: turningOn ? pane : reconcileActiveEditorPane(visible, activePane),
  };
}

export function availableEditorPanePresets(showNotes: boolean): EditorPanePresetId[] {
  return EDITOR_PANE_PRESET_IDS.filter((id) => {
    if (showNotes) return true;
    return id !== "write" && id !== "notes";
  });
}

export function applyEditorPanePreset(
  presetId: EditorPanePresetId,
  showNotes: boolean,
): { visible: EditorVisiblePanes; active: DualPaneActive } {
  if (!showNotes && (presetId === "write" || presetId === "notes")) {
    return applyEditorPanePreset("split", showNotes);
  }
  const preset = EDITOR_PANE_PRESETS[presetId];
  return {
    visible: normalizeEditorVisiblePanes(preset.visible),
    active: preset.active,
  };
}

export function matchingEditorPanePreset(
  visible: EditorVisiblePanes,
  _active: DualPaneActive,
  showNotes: boolean,
): EditorPanePresetId | null {
  for (const id of availableEditorPanePresets(showNotes)) {
    const preset = EDITOR_PANE_PRESETS[id];
    if (
      preset.visible.outline === visible.outline &&
      preset.visible.draft === visible.draft &&
      preset.visible.notes === visible.notes
    ) {
      return id;
    }
  }
  return null;
}

/** Clamp write/notes layouts when the notes pane is unavailable (tables, figures, etc.). */
export function clampEditorPanePrefsForNotesAvailability(
  visible: EditorVisiblePanes,
  active: DualPaneActive,
  notesAvailable: boolean,
): { visible: EditorVisiblePanes; active: DualPaneActive } {
  const normalized = normalizeEditorVisiblePanes(visible);
  if (notesAvailable) {
    return { visible: normalized, active };
  }
  if (!normalized.notes) {
    return {
      visible: normalized,
      active: active === "notes" ? reconcileActiveEditorPane(normalized, "draft") : active,
    };
  }
  const preset = matchingEditorPanePreset(normalized, active, true);
  if (preset === "write" || preset === "notes") {
    return applyEditorPanePreset("split", false);
  }
  const withoutNotes = { ...normalized, notes: false };
  return {
    visible: normalizeEditorVisiblePanes(withoutNotes),
    active: active === "notes" ? reconcileActiveEditorPane(withoutNotes, "draft") : active,
  };
}

export function isDraftNotesSplit(visible: EditorVisiblePanes): boolean {
  return visible.draft && visible.notes && !visible.outline;
}

export function shouldSyncDocumentOutlineForPanes(
  visible: EditorVisiblePanes,
  activePane: EditorPaneId,
): boolean {
  if (!visible.outline) return false;
  if (countVisibleEditorPanes(visible) === 1) return true;
  return activePane === "outline";
}
