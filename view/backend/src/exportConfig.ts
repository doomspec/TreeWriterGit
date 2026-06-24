import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  DEFAULT_EXPORT_DEBOUNCE_MS,
  normalizeExportDebounceMs,
} from "./intervalPresets.js";

export {
  DEFAULT_EXPORT_DEBOUNCE_MS,
  SYNC_INTERVAL_PRESETS_MS as EXPORT_DEBOUNCE_PRESETS_MS,
  type SyncIntervalPresetMs as ExportDebouncePresetMs,
  isAllowedSyncIntervalMs as isAllowedExportDebounceMs,
  normalizeExportDebounceMs,
  formatSyncIntervalLabel as formatExportDebounceLabel,
} from "./intervalPresets.js";

export type ExportConfig = {
  /** Export after manuscript edits (debounced). */
  autoExport: boolean;
  /** Include outlines and non-approved drafts in auto-export. */
  includeDrafts: boolean;
  /** Push to Overleaf when the paper is connected; otherwise write local bundle only. */
  pushOverleaf: boolean;
  /** Wait after the last qualifying edit before exporting. */
  debounceMs: number;
};

export type AutoExportRuntimeState = {
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastPaperSlug: string | null;
  lastMessage: string | null;
};

const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  autoExport: false,
  includeDrafts: true,
  pushOverleaf: true,
  debounceMs: DEFAULT_EXPORT_DEBOUNCE_MS,
};

export async function loadExportConfig(repoRoot: string): Promise<ExportConfig> {
  let config = { ...DEFAULT_EXPORT_CONFIG };

  try {
    const raw = await readFile(path.join(repoRoot, ".treewriter.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      export?: Partial<ExportConfig>;
    };
    if (parsed.export && typeof parsed.export === "object") {
      const patch = parsed.export;
      if (typeof patch.autoExport === "boolean") config.autoExport = patch.autoExport;
      if (typeof patch.includeDrafts === "boolean") config.includeDrafts = patch.includeDrafts;
      if (typeof patch.pushOverleaf === "boolean") config.pushOverleaf = patch.pushOverleaf;
      if (typeof patch.debounceMs === "number" && Number.isFinite(patch.debounceMs)) {
        config.debounceMs = normalizeExportDebounceMs(patch.debounceMs);
      }
    }
  } catch {
    // use defaults
  }

  if (process.env.EXPORT_AUTO === "true") config.autoExport = true;
  if (process.env.EXPORT_AUTO === "false") config.autoExport = false;

  return config;
}

export async function saveExportPreferences(
  repoRoot: string,
  patch: Partial<Pick<ExportConfig, "autoExport" | "includeDrafts" | "pushOverleaf" | "debounceMs">>,
): Promise<void> {
  const configPath = path.join(repoRoot, ".treewriter.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  const exportBlock =
    parsed.export && typeof parsed.export === "object"
      ? { ...(parsed.export as Record<string, unknown>) }
      : {};
  if (patch.autoExport !== undefined) exportBlock.autoExport = patch.autoExport;
  if (patch.includeDrafts !== undefined) exportBlock.includeDrafts = patch.includeDrafts;
  if (patch.pushOverleaf !== undefined) exportBlock.pushOverleaf = patch.pushOverleaf;
  if (patch.debounceMs !== undefined) {
    exportBlock.debounceMs = normalizeExportDebounceMs(patch.debounceMs);
  }
  parsed.export = exportBlock;
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export function createAutoExportRuntimeState(): AutoExportRuntimeState {
  return {
    running: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastPaperSlug: null,
    lastMessage: null,
  };
}
