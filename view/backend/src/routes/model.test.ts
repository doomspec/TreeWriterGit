import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readModelTree } from "../modelTree.js";
import { registerModelRoutes } from "./model.js";
import type { ServerDeps } from "./types.js";

let modelRoot: string;
let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-routes-repo-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
  await writeFile(path.join(modelRoot, "outline.md"), "# Root\n", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function createTestDeps(): ServerDeps {
  return {
    modelRoot,
    repoRoot,
    broadcastModelEvent: () => {},
    getGitSyncState: () => ({
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastOutput: null,
      conflictDetected: false,
      pendingStashRestore: false,
      viewChangesBlocked: false,
    }),
    runGitSync: async () => ({
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastOutput: null,
      conflictDetected: false,
      pendingStashRestore: false,
      viewChangesBlocked: false,
    }),
    getGitSyncConfig: async () => ({
      enabled: false,
      autoSync: false,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }),
    getExportConfig: async () => ({
      autoExport: false,
      includeDrafts: true,
      pushOverleaf: true,
      debounceMs: 60_000,
    }),
    getAutoExportState: () => ({
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastPaperSlug: null,
      lastMessage: null,
    }),
    runAutoExportNow: async () => {},
    reloadGitSyncSchedule: () => {},
  };
}

describe("registerModelRoutes", () => {
  it("registers /api/model/tree and returns the model tree", async () => {
    const app = express();
    registerModelRoutes(app, createTestDeps());

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/model/tree`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { root: string; tree: unknown[] };
      expect(body.root).toBe("model");
      expect(body.tree.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("readModelTree reads files from modelRoot", async () => {
    const tree = await readModelTree(modelRoot);
    expect(tree.some((node) => node.name === "outline.md")).toBe(true);
  });

  it("readModelTree includes folder kind from INDEX.md", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/intro"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/intro/INDEX.md"),
      "---\nkind: unit\ntitle: Intro\n---\n",
      "utf8",
    );
    const tree = await readModelTree(modelRoot);
    const intro = tree
      .find((node) => node.name === "papers")
      ?.children?.find((node) => node.name === "demo")
      ?.children?.find((node) => node.name === "intro");
    expect(intro?.kind).toBe("unit");
  });
});
