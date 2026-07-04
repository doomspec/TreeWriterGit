import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildDispatchContextCliBlock,
  extractSearchTerms,
  gatherSiblingUnitOutlines,
} from "./contextPrefetch.js";
import { readDispatchUnitContext } from "./context.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("extractSearchTerms", () => {
  it("returns frequent meaningful words from outline text", () => {
    const terms = extractSearchTerms(
      "Cell viability assays measure metabolic activity. Viability remains central to interpretation.",
    );
    expect(terms).toContain("viability");
    expect(terms.length).toBeLessThanOrEqual(3);
  });

  it("filters short words and stopwords", () => {
    const terms = extractSearchTerms("This is about the methods and results from our study.");
    expect(terms).not.toContain("about");
    expect(terms).not.toContain("from");
  });
});

describe("buildDispatchContextCliBlock", () => {
  it("returns empty when Zotero local is disabled (CLI ref lives in treewriter-context-cli skill)", async () => {
    const block = await buildDispatchContextCliBlock(repoRoot);
    expect(block).toBe("");
  });
});

describe("gatherSiblingUnitOutlines", () => {
  it("is exported for integration tests via readDispatchUnitContext", () => {
    expect(typeof gatherSiblingUnitOutlines).toBe("function");
  });
});

describe("readDispatchUnitContext manifest", () => {
  it("includes manuscript manifest fields in context", async () => {
    const modelRoot = path.join(repoRoot, "model-manifest-test");
    const unitPath = "papers/demo/intro/unit-a";
    await mkdir(path.join(modelRoot, unitPath), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/INDEX.md"),
      `---
kind: manuscript
doc_type: grant
template_id: nsf-research-proposal
title: Demo
funder: NSF
contribution_mode: kernel
agent_summary: Agent triage blurb
---
# Demo
`,
      "utf8",
    );
    await writeFile(path.join(modelRoot, unitPath, "outline.md"), "# Idea\n", "utf8");
    await writeFile(
      path.join(modelRoot, unitPath, "INDEX.md"),
      "---\nkind: unit\nlinks: []\n---\n",
      "utf8",
    );

    const { context } = await readDispatchUnitContext(modelRoot, unitPath, "expand");
    expect(context).toContain("[Manuscript manifest]");
    expect(context).toContain("doc_type: grant");
    expect(context).toContain("contribution_mode: kernel");
    expect(context).toContain("funder: NSF");
  });
});
