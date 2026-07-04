import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";

import { duplicateNode } from "./nodeDuplicate.js";
import { createNode, orderedChildren } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-node-dup-"));
  await mkdir(path.join(modelRoot, "papers", "demo"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers", "demo", "INDEX.md"),
    matter.stringify("", { kind: "paper", title: "Demo", section_order: [] }),
    "utf8",
  );
  await createNode(modelRoot, "papers/demo", "intro", "section");
  await createNode(modelRoot, "papers/demo/intro", "claim", "unit");
  await writeFile(
    path.join(modelRoot, "papers/demo/intro/claim/draft.md"),
    "First paragraph.\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("duplicateNode", () => {
  it("duplicates a unit after the original", async () => {
    const result = await duplicateNode(modelRoot, "papers/demo/intro/claim");
    expect(result.path).toBe("papers/demo/intro/claim-copy");

    const order = await orderedChildren(modelRoot, "papers/demo/intro");
    expect(order).toEqual(["claim", "claim-copy"]);

    const draft = await readFile(
      path.join(modelRoot, "papers/demo/intro/claim-copy/draft.md"),
      "utf8",
    );
    expect(draft).toContain("First paragraph");
  });

  it("duplicates a section with nested children", async () => {
    const result = await duplicateNode(modelRoot, "papers/demo/intro");
    expect(result.path).toBe("papers/demo/intro-copy");

    const index = matter(
      await readFile(path.join(modelRoot, "papers/demo/intro-copy/INDEX.md"), "utf8"),
    );
    expect(index.data.title).toBe("Intro (copy)");

    const nestedDraft = await readFile(
      path.join(modelRoot, "papers/demo/intro-copy/claim/draft.md"),
      "utf8",
    );
    expect(nestedDraft).toContain("First paragraph");
  });
});
