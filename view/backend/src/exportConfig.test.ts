import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadExportConfig, saveExportPreferences } from "./exportConfig.js";
import { paperSlugFromModelPath, shouldAutoExportPath } from "./autoExportRunner.js";

let repoRoot = "";

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-export-config-"));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("loadExportConfig", () => {
  it("defaults autoExport to false", async () => {
    const config = await loadExportConfig(repoRoot);
    expect(config.autoExport).toBe(false);
    expect(config.includeDrafts).toBe(true);
    expect(config.pushOverleaf).toBe(true);
    expect(config.blockOnOrphanRefs).toBe(false);
    expect(config.blockOnUnapproved).toBe(false);
    expect(config.blockOnMissingCitations).toBe(false);
  });

  it("reads export block from .treewriter.json", async () => {
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      JSON.stringify({
        export: {
          autoExport: true,
          includeDrafts: false,
          pushOverleaf: false,
          blockOnOrphanRefs: true,
          blockOnUnapproved: true,
          blockOnMissingCitations: true,
        },
      }),
      "utf8",
    );
    const config = await loadExportConfig(repoRoot);
    expect(config.autoExport).toBe(true);
    expect(config.includeDrafts).toBe(false);
    expect(config.pushOverleaf).toBe(false);
    expect(config.blockOnOrphanRefs).toBe(true);
    expect(config.blockOnUnapproved).toBe(true);
    expect(config.blockOnMissingCitations).toBe(true);
  });
});

describe("saveExportPreferences", () => {
  it("persists export toggles", async () => {
    await saveExportPreferences(repoRoot, {
      autoExport: true,
      pushOverleaf: false,
      blockOnOrphanRefs: true,
    });
    const raw = JSON.parse(await readFile(path.join(repoRoot, ".treewriter.json"), "utf8")) as {
      export: {
        autoExport: boolean;
        pushOverleaf: boolean;
        blockOnOrphanRefs: boolean;
      };
    };
    expect(raw.export.autoExport).toBe(true);
    expect(raw.export.pushOverleaf).toBe(false);
    expect(raw.export.blockOnOrphanRefs).toBe(true);
  });

  it("persists debounce preset and normalizes unknown values", async () => {
    await saveExportPreferences(repoRoot, { debounceMs: 3_600_000 });
    let config = await loadExportConfig(repoRoot);
    expect(config.debounceMs).toBe(3_600_000);

    await saveExportPreferences(repoRoot, { debounceMs: 999_999 });
    config = await loadExportConfig(repoRoot);
    expect(config.debounceMs).toBe(60_000);
  });
});

describe("auto export path helpers", () => {
  it("detects manuscript draft paths under papers/", () => {
    expect(shouldAutoExportPath("papers/vibecount/results/foo/draft.md")).toBe(true);
    expect(shouldAutoExportPath("papers/vibecount/abstract/outline.md")).toBe(true);
    expect(shouldAutoExportPath("papers/vibecount/INDEX.md")).toBe(false);
    expect(shouldAutoExportPath("papers/vibecount/notes/literature/x.md")).toBe(false);
    expect(shouldAutoExportPath("papers/vibecount/intro/temp-notes.md")).toBe(false);
  });

  it("extracts paper slug from model paths", () => {
    expect(paperSlugFromModelPath("papers/vibecount/results/foo/draft.md")).toBe("vibecount");
    expect(paperSlugFromModelPath("outline.md")).toBeNull();
  });
});
