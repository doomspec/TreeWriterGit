import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enrichModelEvent, resetModelEventBroadcastState } from "./modelEvents.js";
import {
  getCachedModelTree,
  invalidateModelTreeCache,
  modelTreeCacheSize,
} from "./modelTreeCache.js";

let modelRoot: string;

beforeEach(async () => {
  resetModelEventBroadcastState();
  invalidateModelTreeCache();
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-tree-cache-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers", "demo", "INDEX.md"),
    "---\nkind: paper\n---\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
  resetModelEventBroadcastState();
  invalidateModelTreeCache();
});

describe("modelTreeCache", () => {
  it("caches subtree reads until treeVersion bumps", async () => {
    expect(modelTreeCacheSize()).toBe(0);
    await getCachedModelTree(modelRoot, { rootPath: "papers/demo" });
    expect(modelTreeCacheSize()).toBe(1);
    await getCachedModelTree(modelRoot, { rootPath: "papers/demo" });
    expect(modelTreeCacheSize()).toBe(1);

    enrichModelEvent({ path: "papers/demo/intro/INDEX.md" });
    await getCachedModelTree(modelRoot, { rootPath: "papers/demo" });
    expect(modelTreeCacheSize()).toBe(1);
  });

  it("does not cache across content-only events", async () => {
    await getCachedModelTree(modelRoot);
    expect(modelTreeCacheSize()).toBe(1);
    enrichModelEvent({ path: "papers/demo/draft.md" });
    await getCachedModelTree(modelRoot);
    expect(modelTreeCacheSize()).toBe(1);
  });
});
