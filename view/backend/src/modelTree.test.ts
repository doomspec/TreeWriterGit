import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readModelTree } from "./modelTree.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-model-tree-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers", "demo", "INDEX.md"),
    "---\nkind: paper\nchild_order:\n  - methods\n  - intro\n---\n",
    "utf8",
  );
  await mkdir(path.join(modelRoot, "papers", "demo", "intro"), { recursive: true });
  await writeFile(path.join(modelRoot, "papers", "demo", "intro", "INDEX.md"), "---\nkind: section\n---\n", "utf8");
  await writeFile(path.join(modelRoot, "papers", "demo", "intro", "outline.md"), "# Intro\n", "utf8");
  await mkdir(path.join(modelRoot, "papers", "demo", "intro", "background"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers", "demo", "intro", "background", "INDEX.md"),
    "---\nkind: unit\n---\n",
    "utf8",
  );
  await mkdir(path.join(modelRoot, "papers", "demo", "notes"), { recursive: true });
  await writeFile(path.join(modelRoot, "papers", "demo", "notes", "INDEX.md"), "---\nkind: notes\n---\n", "utf8");
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("readModelTree", () => {
  it("reads a scoped subtree by rootPath", async () => {
    const tree = await readModelTree(modelRoot, { rootPath: "papers/demo/intro" });
    expect(tree.map((node) => node.name)).toContain("background");
    expect(tree.map((node) => node.name)).not.toContain("demo");
  });

  it("returns hasChildren stubs when maxDepth is 0", async () => {
    const tree = await readModelTree(modelRoot, { maxDepth: 0 });
    const papers = tree.find((node) => node.name === "papers");
    expect(papers?.hasChildren).toBe(true);
    expect(papers?.children).toBeUndefined();
  });

  it("skips notes, .sessions, and .trash directories", async () => {
    const tree = await readModelTree(modelRoot, { rootPath: "papers/demo" });
    expect(tree.map((node) => node.name)).not.toContain("notes");
  });

  it("includes childOrder on directory nodes and sorts children by INDEX child_order", async () => {
    await mkdir(path.join(modelRoot, "papers", "demo", "methods"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers", "demo", "methods", "INDEX.md"),
      "---\nkind: section\n---\n",
      "utf8",
    );

    const scoped = await readModelTree(modelRoot, { rootPath: "papers/demo" });
    const scopedDirs = scoped.filter((node) => node.type === "directory").map((node) => node.name);
    expect(scopedDirs).toEqual(["methods", "intro"]);

    const papers = await readModelTree(modelRoot, { rootPath: "papers" });
    const demo = papers.find((node) => node.name === "demo");
    expect(demo?.childOrder).toEqual(["methods", "intro"]);
  });

  it("falls back to section_order when child_order is absent on paper INDEX", async () => {
    await mkdir(path.join(modelRoot, "papers", "guide"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers", "guide", "INDEX.md"),
      "---\nkind: paper\nsection_order:\n  - appendix\n  - body\n---\n",
      "utf8",
    );
    await mkdir(path.join(modelRoot, "papers", "guide", "body"), { recursive: true });
    await writeFile(path.join(modelRoot, "papers", "guide", "body", "INDEX.md"), "---\nkind: section\n---\n", "utf8");
    await mkdir(path.join(modelRoot, "papers", "guide", "appendix"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers", "guide", "appendix", "INDEX.md"),
      "---\nkind: section\n---\n",
      "utf8",
    );

    const tree = await readModelTree(modelRoot, { rootPath: "papers/guide" });
    const dirs = tree.filter((node) => node.type === "directory").map((node) => node.name);
    expect(dirs).toEqual(["appendix", "body"]);

    const papers = await readModelTree(modelRoot, { rootPath: "papers" });
    const guide = papers.find((node) => node.name === "guide");
    expect(guide?.childOrder).toEqual(["appendix", "body"]);
  });
});
