import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { getCachedGraph, graphCacheSize, invalidateGraphCache, invalidateGraphCacheForChange } from "./graphCache.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-graph-cache-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers/demo/INDEX.md"),
    matter.stringify("", { kind: "paper", title: "Demo", links: [] }),
    "utf8",
  );
  invalidateGraphCache();
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
  invalidateGraphCache();
});

describe("graphCache", () => {
  it("caches graph responses per root key", async () => {
    expect(graphCacheSize()).toBe(0);
    await getCachedGraph(modelRoot, "");
    expect(graphCacheSize()).toBe(1);
    await getCachedGraph(modelRoot, "");
    expect(graphCacheSize()).toBe(1);
  });

  it("invalidateGraphCache clears entries", async () => {
    await getCachedGraph(modelRoot, "papers/demo");
    expect(graphCacheSize()).toBe(1);
    invalidateGraphCache();
    expect(graphCacheSize()).toBe(0);
  });

  it("invalidateGraphCacheForChange drops only the affected paper graph", async () => {
    await getCachedGraph(modelRoot, "");
    await getCachedGraph(modelRoot, "papers/demo");
    expect(graphCacheSize()).toBe(2);
    invalidateGraphCacheForChange("papers/demo/intro/INDEX.md");
    expect(graphCacheSize()).toBe(1);
    await getCachedGraph(modelRoot, "papers/demo");
    expect(graphCacheSize()).toBe(2);
  });
});
