import {
  normalizeEditorVisiblePanes,
  type EditorVisiblePanes,
} from "@/lib/editorVisiblePanes";
import type { DualPaneActive } from "@/lib/workspacePreferences";

export type EditorPaneScopePrefs = {
  visible: EditorVisiblePanes;
  active: DualPaneActive;
};

export const EDITOR_PANE_SCOPE_PATH_RE = /^papers\/[^/]+(\/.*)?$/;
export const EDITOR_PANE_SCOPE_MAX_ENTRIES = 30;

export function isEditorPaneScopePath(path: string | null | undefined): path is string {
  return Boolean(path && EDITOR_PANE_SCOPE_PATH_RE.test(path));
}

/** Paper-level prefs key so sections/units share the same pane layout within a paper. */
export function resolveEditorPanePrefsScopePath(
  editorScopePath: string | null | undefined,
  paperRootPath: string | null | undefined,
): string | null {
  if (!editorScopePath) return null;
  if (
    paperRootPath &&
    isEditorPaneScopePath(paperRootPath) &&
    (editorScopePath === paperRootPath || editorScopePath.startsWith(`${paperRootPath}/`))
  ) {
    return paperRootPath;
  }
  return editorScopePath;
}

export function normalizeEditorPaneScopePrefs(
  input: Partial<EditorPaneScopePrefs> | undefined,
): EditorPaneScopePrefs | null {
  if (!input || typeof input !== "object") return null;
  const active = input.active;
  if (active !== "outline" && active !== "draft" && active !== "notes") return null;
  return {
    visible: normalizeEditorVisiblePanes(input.visible),
    active,
  };
}

export function sanitizeEditorPanePrefsByScope(
  input: Record<string, EditorPaneScopePrefs> | undefined,
): Record<string, EditorPaneScopePrefs> {
  if (!input || typeof input !== "object") return {};
  const next: Record<string, EditorPaneScopePrefs> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isEditorPaneScopePath(key)) continue;
    const normalized = normalizeEditorPaneScopePrefs(value);
    if (normalized) next[key] = normalized;
  }
  return next;
}

/** Move `scopePath` to most-recent and cap map size (LRU via insertion order). */
export function upsertEditorPanePrefsByScope(
  map: Record<string, EditorPaneScopePrefs>,
  scopePath: string,
  prefs: EditorPaneScopePrefs,
): Record<string, EditorPaneScopePrefs> {
  const { [scopePath]: _removed, ...rest } = map;
  const next: Record<string, EditorPaneScopePrefs> = {
    ...rest,
    [scopePath]: {
      visible: normalizeEditorVisiblePanes(prefs.visible),
      active: prefs.active,
    },
  };
  const keys = Object.keys(next);
  if (keys.length <= EDITOR_PANE_SCOPE_MAX_ENTRIES) return next;
  const trimmed: Record<string, EditorPaneScopePrefs> = {};
  const keep = keys.slice(keys.length - EDITOR_PANE_SCOPE_MAX_ENTRIES);
  for (const key of keep) {
    trimmed[key] = next[key]!;
  }
  return trimmed;
}
