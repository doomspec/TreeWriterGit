import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";

import { convertUnitToSubsection } from "./nodeConvert.js";
import { createNode } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-node-convert-"));
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
    "First paragraph.\n\nSecond paragraph.\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("convertUnitToSubsection", () => {
  it("converts a unit into a subsection with paragraph units", async () => {
    const result = await convertUnitToSubsection(modelRoot, "papers/demo/intro/claim");
    expect(result.path).toBe("papers/demo/intro/claim");
    expect(result.childPaths.length).toBeGreaterThanOrEqual(2);

    const index = matter(
      await readFile(path.join(modelRoot, "papers/demo/intro/claim/INDEX.md"), "utf8"),
    );
    expect(index.data.kind).toBe("subsection");
    expect(index.data.child_order).toHaveLength(2);

    const firstDraft = await readFile(
      path.join(modelRoot, "papers/demo/intro/claim/first-paragraph/draft.md"),
      "utf8",
    );
    expect(firstDraft).toContain("First paragraph");
  });
});
