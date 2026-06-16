import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { searchModel, validateSearchQuery } from "./search.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-search-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await mkdir(path.join(modelRoot, "notes"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers/demo/intro.md"),
    "# Intro\n\nCell viability matters.\n",
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, "notes/lit.md"),
    "Background on viability assays.\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("searchModel", () => {
  it("finds matches case-insensitively with path, line, excerpt", async () => {
    const hits = await searchModel(modelRoot, "VIABILITY");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0]).toMatchObject({ path: expect.stringContaining(".md"), line: expect.any(Number) });
    expect(hits.some((h) => h.excerpt.toLowerCase().includes("viability"))).toBe(true);
  });

  it("scopes search to rootRel", async () => {
    const hits = await searchModel(modelRoot, "viability", "papers/demo");
    expect(hits.every((h) => h.path.startsWith("papers/demo"))).toBe(true);
  });

  it("rejects path escape via rootRel", async () => {
    await expect(searchModel(modelRoot, "viability", "../..")).rejects.toBeInstanceOf(ModelFsError);
  });
});

describe("validateSearchQuery", () => {
  it("requires non-empty q", () => {
    expect(() => validateSearchQuery("  ")).toThrow(ModelFsError);
  });
});
