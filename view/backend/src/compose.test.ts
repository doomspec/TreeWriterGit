import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { composeSectionView, parseOutlineSummary } from "./compose.js";

let root: string;

async function writeSection(
  rel: string,
  frontmatter: Record<string, unknown>,
  outlineBody = "",
  draftBody = "",
): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    matter.stringify(`# ${rel}\n`, frontmatter),
    "utf8",
  );
  if (outlineBody) {
    await writeFile(path.join(abs, "outline.md"), outlineBody, "utf8");
  }
  if (draftBody) {
    await writeFile(path.join(abs, "draft.md"), draftBody, "utf8");
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "twg-compose-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("parseOutlineSummary", () => {
  it("reads ## Summary section", () => {
    const md = `# Title\n\n## Summary\n\nHello summary.\n\n## Outline\n`;
    expect(parseOutlineSummary(md)).toBe("Hello summary.");
  });
});

describe("composeSectionView", () => {
  it("composes subsection summaries and stitched drafts", async () => {
    await writeSection(
      "introduction",
      { kind: "section", title: "Introduction", child_order: ["background", "claims"] },
      `# Introduction\n\n## Summary\n\nMotivation here.\n`,
    );
    await writeSection(
      "introduction/background",
      { kind: "unit", title: "Background" },
      `# Background\n\n## Summary\n\nPrior work summary.\n`,
      "# Background\n\nPrior work draft prose.\n",
    );
    await writeSection(
      "introduction/claims",
      { kind: "unit", title: "Claims" },
      `# Claims\n\n## Summary\n\nOur claims summary.\n`,
      "# Claims\n\nClaims draft prose.\n",
    );

    const view = await composeSectionView(root, "introduction");
    expect(view.title).toBe("Introduction");
    expect(view.children).toHaveLength(2);
    expect(view.outlineMarkdown).toContain("### [Background](background/INDEX.md)");
    expect(view.outlineMarkdown).toContain("Prior work summary.");
    expect(view.draftMarkdown).toContain("Prior work draft prose.");
    expect(view.draftMarkdown).toContain("Claims draft prose.");
  });
});
