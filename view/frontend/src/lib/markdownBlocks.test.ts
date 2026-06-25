import { describe, expect, it, beforeEach } from "vitest";

import {
  globalLineFromBlockPosition,
  joinMarkdownBlocks,
  reconcileBlocks,
  resetBlockIdCounterForTests,
  splitMarkdownIntoBlocks,
} from "./markdownBlocks";

describe("markdownBlocks", () => {
  beforeEach(() => {
    resetBlockIdCounterForTests();
  });

  it("keeps label lines with following bullet lists in one block", () => {
    const source = `Overview:
- First point
- Second point`;
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].markdown).toContain("Overview:");
    expect(blocks[0].markdown).toContain("- First point");
  });

  it("splits paragraphs on blank lines", () => {
    const source = `## Summary

- Use an hourglass structure
- Do not include references

## Outline

- Broad context`;
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].markdown).toContain("## Summary");
    expect(blocks[0].markdown).toContain("- Use an hourglass");
    expect(blocks[1].markdown).toContain("## Outline");
    expect(blocks[1].markdown).toContain("Broad context");
  });

  it("keeps fenced code as a single block", () => {
    const source = `Intro paragraph.

\`\`\`python
def hello():
    pass
\`\`\`

After code.`;
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks).toHaveLength(3);
    expect(blocks[1].markdown).toContain("```python");
    expect(blocks[1].markdown).toContain("def hello");
  });

  it("preserves inline notes across split/join", () => {
    const source = "Text \\iy{suggestion} here.\n\nSecond paragraph.";
    const blocks = splitMarkdownIntoBlocks(source);
    const joined = joinMarkdownBlocks(blocks);
    expect(joined).toContain("\\iy{suggestion}");
    expect(joined).toContain("Second paragraph.");
  });

  it("keeps linked headings as separate blocks", () => {
    const source = `## [Introduction](introduction)

Opening paragraph.

## [Methods](methods)

Methods body.`;
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks[0].markdown).toBe("## [Introduction](introduction)");
    expect(blocks[1].markdown).toBe("Opening paragraph.");
    expect(blocks[2].markdown).toBe("## [Methods](methods)");
  });

  it("joins blocks with double newlines", () => {
    const blocks = splitMarkdownIntoBlocks("A\n\nB");
    expect(joinMarkdownBlocks(blocks)).toBe("A\n\nB");
  });

  it("reconciles blocks by content to preserve ids", () => {
    const initial = splitMarkdownIntoBlocks("First.\n\nSecond.");
    const firstId = initial[0].id;
    const reconciled = reconcileBlocks(initial, "First.\n\nSecond updated.");
    expect(reconciled[0].id).toBe(firstId);
    expect(reconciled[1].markdown).toBe("Second updated.");
  });

  it("force reset replaces all block ids", () => {
    const initial = splitMarkdownIntoBlocks("A\n\nB");
    const reset = reconcileBlocks(initial, "A\n\nB", true);
    expect(reset[0].id).not.toBe(initial[0].id);
  });

  it("keeps inline figure embeds in one paragraph block", () => {
    const source = `(Fig.
::figure[papers/vibecount/figures/fig1]
). The user uploads images.`;
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].markdown).toContain("::figure[papers/vibecount/figures/fig1]");
  });

  it("splits standalone figure directives into their own block", () => {
    const source = "Before.\n\n::figure[papers/vibecount/figures/fig1]\n\nAfter.";
    const blocks = splitMarkdownIntoBlocks(source);
    expect(blocks).toHaveLength(3);
    expect(blocks[1].markdown).toBe("::figure[papers/vibecount/figures/fig1]");
  });

  it("maps block caret positions to global line numbers", () => {
    const blocks = splitMarkdownIntoBlocks("## A\n\nPara one.\n\n## B\n\nPara two.");
    const secondSection = blocks.find((block) => block.markdown.startsWith("## B"));
    expect(secondSection).toBeTruthy();
    expect(globalLineFromBlockPosition(blocks, secondSection!.id, 0)).toBe(5);
  });
});
