import { describe, expect, it } from "vitest";

import {
  expandEmbedBlocksInMarkdown,
  parseEmbedBlock,
  replaceInlineFigureEmbedsWithRefs,
} from "./embedBlocks";

describe("embedBlocks", () => {
  it("isolates ::figure lines with blank lines", () => {
    const source = "Before.\n\n::figure[papers/demo/figures/fig1]\n\nAfter.";
    expect(expandEmbedBlocksInMarkdown(source)).toBe(
      "Before.\n\n::figure[papers/demo/figures/fig1]\n\nAfter.",
    );
  });

  it("keeps inline ::figure lines inside the paragraph", () => {
    const source = "(Fig.\n::figure[papers/demo/figures/fig1]\n).";
    expect(expandEmbedBlocksInMarkdown(source)).toBe(source);
  });

  it("replaces inline ::figure with ref keys for display", () => {
    const { markdown, figurePaths } = replaceInlineFigureEmbedsWithRefs(
      "(Fig.\n::figure[papers/demo/figures/fig1]\n).",
    );
    expect(figurePaths).toEqual(["papers/demo/figures/fig1"]);
    expect(markdown).toContain("\\ref{fig:fig1}");
    expect(markdown).not.toContain("::figure[");
  });

  it("isolates ::equation lines with blank lines", () => {
    const source = "Intro\n\n::equation[papers/demo/equations/eq1]\n\nOutro";
    expect(expandEmbedBlocksInMarkdown(source)).toBe(
      "Intro\n\n::equation[papers/demo/equations/eq1]\n\nOutro",
    );
  });

  it("parses ::figure directive blocks", () => {
    expect(parseEmbedBlock("::figure[papers/vibecount/figures/fig1]")).toEqual({
      kind: "figure",
      targetPath: "papers/vibecount/figures/fig1",
    });
  });

  it("parses fenced figure blocks", () => {
    const markdown = "```treewriter-figure\npapers/demo/figures/fig2\n```";
    expect(parseEmbedBlock(markdown)).toEqual({
      kind: "figure",
      targetPath: "papers/demo/figures/fig2",
    });
  });

  it("returns null for inline figure syntax", () => {
    expect(parseEmbedBlock("See ::figure[path] here.")).toBeNull();
  });
});
