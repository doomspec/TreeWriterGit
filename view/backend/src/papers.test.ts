import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { countUnitsUnder } from "./papers.js";
import { buildCombinedMarkdown } from "./export.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-papers-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

async function writeIndex(rel: string, data: Record<string, unknown>, body = "") {
  const abs = path.join(modelRoot, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(abs, "INDEX.md"), matter.stringify(body, data), "utf8");
}

describe("countUnitsUnder vs export walk", () => {
  it("counts the same exportable units as buildCombinedMarkdown", async () => {
    await writeIndex("papers/demo", {
      kind: "paper",
      title: "Demo",
      section_order: ["sections"],
    });
    await writeIndex("papers/demo/sections", {
      kind: "section",
      child_order: ["intro", "extra-on-disk"],
    });
    await writeIndex("papers/demo/sections/intro", { kind: "section", child_order: ["problem"] });
    await writeIndex("papers/demo/sections/intro/problem", {
      kind: "unit",
      title: "Problem",
      status: "drafted",
    });
    await mkdir(path.join(modelRoot, "papers/demo/sections/intro/problem"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/sections/intro/problem/draft.md"),
      "# Problem\n\nBody text.\n",
      "utf8",
    );

    await writeIndex("papers/demo/sections/extra-on-disk", {
      kind: "section",
      child_order: ["claim"],
    });
    await writeIndex("papers/demo/sections/extra-on-disk/claim", {
      kind: "unit",
      title: "Claim",
      status: "drafted",
    });
    await mkdir(path.join(modelRoot, "papers/demo/sections/extra-on-disk/claim"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/sections/extra-on-disk/claim/draft.md"),
      "Another unit.\n",
      "utf8",
    );

    const counts = await countUnitsUnder(modelRoot, "papers/demo");
    const { unitCount } = await buildCombinedMarkdown(modelRoot, "papers/demo", true);
    expect(counts.total).toBe(2);
    expect(unitCount).toBe(2);
  });
});
