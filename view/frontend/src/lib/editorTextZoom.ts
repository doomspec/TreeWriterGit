import type { CSSProperties } from "react";

const STORAGE_KEY = "treewriter.editorTextZoom.v2";

/** Base body scale baked into CSS; 100% zoom uses this size (formerly the 85% zoom step). */
export const EDITOR_TEXT_BASE_SCALE = 0.85;

/** Relative text scale for markdown reading / preview panes. */
export const EDITOR_TEXT_ZOOM_MIN = 0.85;
export const EDITOR_TEXT_ZOOM_MAX = 1.5;
export const EDITOR_TEXT_ZOOM_DEFAULT = 1;
export const EDITOR_TEXT_ZOOM_STEP = 0.05;

export function clampEditorTextZoom(value: number): number {
  return Math.min(EDITOR_TEXT_ZOOM_MAX, Math.max(EDITOR_TEXT_ZOOM_MIN, Math.round(value * 100) / 100));
}

export function loadEditorTextZoom(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EDITOR_TEXT_ZOOM_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return EDITOR_TEXT_ZOOM_DEFAULT;
    return clampEditorTextZoom(parsed);
  } catch {
    return EDITOR_TEXT_ZOOM_DEFAULT;
  }
}

export function saveEditorTextZoom(zoom: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampEditorTextZoom(zoom)));
  } catch {
    // quota or private mode
  }
}

export function stepEditorTextZoom(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? EDITOR_TEXT_ZOOM_STEP : -EDITOR_TEXT_ZOOM_STEP;
  return clampEditorTextZoom(current + delta);
}

export function formatEditorTextZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function editorTextZoomStyle(zoom: number): CSSProperties {
  return {
    "--editor-text-base": String(EDITOR_TEXT_BASE_SCALE),
    "--editor-text-zoom": String(clampEditorTextZoom(zoom)),
  } as CSSProperties;
}
