import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";

import { exportPaper } from "./export.js";
import { normalizeDocxParagraphBreaks, prepareMarkdownForDocxExport } from "./exportDocx.js";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-docx-export-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

async function seedApprovedPaper() {
  const paperRel = "papers/demo";
  await mkdir(path.join(modelRoot, paperRel, "intro"), { recursive: true });
  await writeFile(
    path.join(modelRoot, paperRel, "INDEX.md"),
    matter.stringify("", {
      kind: "paper",
      title: "Demo Paper",
      section_order: ["intro"],
    }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, paperRel, "intro", "INDEX.md"),
    matter.stringify("", {
      kind: "section",
      title: "Intro",
      child_order: ["claim"],
    }),
    "utf8",
  );
  await mkdir(path.join(modelRoot, paperRel, "intro", "claim"), { recursive: true });
  await writeFile(
    path.join(modelRoot, paperRel, "intro", "claim", "INDEX.md"),
    matter.stringify("", { kind: "unit", title: "Claim", status: "approved" }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, paperRel, "intro", "claim", "outline.md"),
    "# Claim\n\n",
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, paperRel, "intro", "claim", "draft.md"),
    "Approved claim with [@demo2024] and [[papers/demo/figures/fig1|Fig. 1]].",
    "utf8",
  );
  await mkdir(path.join(modelRoot, paperRel, "notes", "literature"), { recursive: true });
  await writeFile(
    path.join(modelRoot, paperRel, "notes", "literature", "demo2024.md"),
    matter.stringify("# Demo\n", {
      type: "literature",
      cite_key: "demo2024",
      authors: "Smith, A.",
      year: "2024",
      title: "Demo study",
    }),
    "utf8",
  );
}

describe("prepareMarkdownForDocxExport", () => {
  it("converts pandoc cites to parenthetical keys and strips author-note macros", () => {
    const output = prepareMarkdownForDocxExport("Finding \\todo{iy}{note} with [@demo2024].");
    expect(output).toContain("(demo2024)");
    expect(output).not.toContain("\\todo");
  });

  it("flattens fragmented inline math into plain text for Word", () => {
    const input =
      "We benchmarked with 4$\\times$5 tiling, mAP@50 $< 0.09$, and Fig. 5C.";
    const output = prepareMarkdownForDocxExport(input);
    expect(output).toContain("4×5 tiling");
    expect(output).toContain("mAP@50 < 0.09");
    expect(output).toContain("Fig. 5C");
    expect(output).not.toContain("$");
    expect(output).not.toContain("\\times");
  });

  it("uses blank lines between prose lines so Word gets paragraph breaks", () => {
    const output = normalizeDocxParagraphBreaks("First sentence.\nSecond sentence.\n\nAlready separate.");
    expect(output).toBe("First sentence.\n\nSecond sentence.\n\nAlready separate.");
    expect(normalizeDocxParagraphBreaks("- one\n- two")).toBe("- one\n- two");
  });
});

describe("exportPaper docx", () => {
  it("writes a .docx file for an approved paper", async () => {
    await seedApprovedPaper();
    const result = await exportPaper(modelRoot, repoRoot, {
      paperSlug: "demo",
      format: "docx",
      includeDrafts: false,
    });

    expect(result.format).toBe("docx");
    expect(result.path.endsWith(".docx")).toBe(true);

    const abs = path.join(repoRoot, result.path);
    const bytes = await readFile(abs);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});
