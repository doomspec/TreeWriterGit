import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNode } from "./modelFs.js";
import { archiveNode, listTrashedItems, purgeAllTrashedItems, purgeTrashedItem, restoreTrashedItem } from "./trash.js";

describe("trash", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "tw-trash-"));
    await createNode(root, "papers", "demo", "section");
    await createNode(root, "papers/demo", "results", "section");
    await createNode(root, "papers/demo/results", "finding", "unit");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("archives a unit into .trash and removes it from the tree", async () => {
    const item = await archiveNode(root, "papers/demo/results/finding");
    expect(item.originalPath).toBe("papers/demo/results/finding");
    expect(item.trashPath).toMatch(/^papers\/demo\/\.trash\/results\/finding$/);

    const listed = await listTrashedItems(root, "papers/demo");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(item.id);
  });

  it("restores a trashed item to its original location", async () => {
    const item = await archiveNode(root, "papers/demo/results/finding");
    const restored = await restoreTrashedItem(root, "papers/demo", item.id);
    expect(restored.originalPath).toBe("papers/demo/results/finding");
    expect(await listTrashedItems(root, "papers/demo")).toHaveLength(0);
  });

  it("permanently purges a trashed item", async () => {
    const item = await archiveNode(root, "papers/demo/results/finding");
    await purgeTrashedItem(root, "papers/demo", item.id);
    expect(await listTrashedItems(root, "papers/demo")).toHaveLength(0);
  });

  it("permanently purges all trashed items", async () => {
    await archiveNode(root, "papers/demo/results/finding");
    await createNode(root, "papers/demo/results", "other", "unit");
    await archiveNode(root, "papers/demo/results/other");
    expect(await listTrashedItems(root, "papers/demo")).toHaveLength(2);

    const result = await purgeAllTrashedItems(root, "papers/demo");
    expect(result.purgedCount).toBe(2);
    expect(await listTrashedItems(root, "papers/demo")).toHaveLength(0);
  });

  it("archives a figure note path without .md extension and its source file", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const noteDir = path.join(root, "papers/demo/notes/data");
    await mkdir(noteDir, { recursive: true });
    await writeFile(
      path.join(noteDir, "fig-example.md"),
      "---\nkind: figure\ntitle: Example figure\n---\n# Example figure\n",
      "utf8",
    );
    await writeFile(path.join(noteDir, "fig-example.mmd"), "flowchart LR\n  A --> B\n", "utf8");

    const item = await archiveNode(root, "papers/demo/notes/data/fig-example");
    expect(item.originalPath).toBe("papers/demo/notes/data/fig-example");
    expect(item.bundle).toHaveLength(2);

    expect(
      (await import("node:fs")).existsSync(path.join(root, "papers/demo/notes/data/fig-example.md")),
    ).toBe(false);
    expect(
      (await import("node:fs")).existsSync(path.join(root, "papers/demo/notes/data/fig-example.mmd")),
    ).toBe(false);
    expect(
      (await import("node:fs")).existsSync(
        path.join(root, "papers/demo/.trash/notes/data/fig-example.md"),
      ),
    ).toBe(true);
    expect(
      (await import("node:fs")).existsSync(
        path.join(root, "papers/demo/.trash/notes/data/fig-example.mmd"),
      ),
    ).toBe(true);
  });
});
