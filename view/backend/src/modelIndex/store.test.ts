import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { getModelIndexStore, resetModelIndexStores } from "./store.js";

let modelRoot: string;
let dbPath: string;

beforeEach(async () => {
  resetModelIndexStores();
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-model-index-"));
  dbPath = path.join(modelRoot, "index.sqlite");
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers/demo/intro.md"),
    "# Intro\n\nCell viability matters.\n",
    "utf8",
  );
});

afterEach(async () => {
  resetModelIndexStores();
  await rm(modelRoot, { recursive: true, force: true });
});

describe("ModelIndexStore", () => {
  it("indexes markdown and returns scoped fts hits", async () => {
    const store = getModelIndexStore(modelRoot, dbPath);
    await store.syncScope("");
    const hits = store.search("viability", "", 10);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]?.path).toContain("intro.md");
  });

  it("reindexes after invalidation", async () => {
    const store = getModelIndexStore(modelRoot, dbPath);
    await store.syncScope("");
    store.removeIndexedFile("papers/demo/intro.md");
    await writeFile(
      path.join(modelRoot, "papers/demo/intro.md"),
      "# Intro\n\nUpdated viability wording.\n",
      "utf8",
    );
    await store.syncScope("");
    const hits = store.search("wording", "", 10);
    expect(hits.some((hit) => hit.excerpt.toLowerCase().includes("wording"))).toBe(true);
  });
});
