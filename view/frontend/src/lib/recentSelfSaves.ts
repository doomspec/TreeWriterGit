/**
 * Tracks model-file paths this client just saved, so the resulting
 * server-broadcast `model-changed` event doesn't bounce back and re-trigger a
 * reload of the very file the editor already has in sync. Without this, every
 * autosave fires: save → broadcast → path-version bump → editor file-load
 * effect re-runs → state churn / visible flicker while typing.
 *
 * Only OUR own writes are marked, so genuinely external edits (e.g. an AI
 * dispatch writing draft.md on the backend) still bump and refresh the editor.
 */

const SELF_SAVE_TTL_MS = 2_500;

const recentSaves = new Map<string, number>();

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function markSelfSave(path: string): void {
  recentSaves.set(normalize(path), nowMs());
}

/** True if `path` was saved by this client within the TTL; expires the entry when checked. */
export function wasRecentlySelfSaved(path: string): boolean {
  const key = normalize(path);
  const at = recentSaves.get(key);
  if (at === undefined) return false;
  const fresh = nowMs() - at < SELF_SAVE_TTL_MS;
  // A broadcast for a self-save arrives once; consume it so a later genuine
  // external edit to the same path is not accidentally swallowed.
  recentSaves.delete(key);
  return fresh;
}
