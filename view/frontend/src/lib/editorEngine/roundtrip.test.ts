import { describe, expect, it } from "vitest";

import { parseMarkdown, roundtrip } from "./roundtrip";

/** A custom macro round-trips identically when it is the whole paragraph. */
function expectStable(markdown: string) {
  const once = roundtrip(markdown);
  expect(once.trim()).toBe(markdown.trim());
  // idempotent: a second pass changes nothing.
  expect(roundtrip(once).trim()).toBe(once.trim());
}

describe("treewriter dialect round-trip", () => {
  it("preserves figure embeds", () => expectStable("::figure[papers/my-study/figures/fig1]"));
  it("preserves equation embeds", () => expectStable("::equation[papers/slug/equations/name]"));
  it("preserves pandoc citation (single)", () => expectStable("Cite here [@cite_key] inline."));
  it("preserves pandoc citation (multiple)", () => expectStable("See [@a2024; @b2020] for details."));
  it("preserves latex cite", () => expectStable("Legacy \\cite{smith2020} marker."));
  it("preserves label and ref", () => expectStable("Defined \\label{fig:one} and \\ref{fig:one} here."));
  it("preserves wikilink with label", () => expectStable("Open [[papers/my-study/figures/fig1|Figure 1]] now."));
  it("preserves wikilink without label", () => expectStable("Open [[papers/x/notes/data]] now."));
  it("preserves highlight", () => expectStable("This is \\hl{green}{important} text."));
  it("preserves author note", () => expectStable("A claim \\iy{needs a source} here."));

  it("treats macros inside code spans as literal", () => {
    const md = "Use `[@key]` and `::figure[…]` and `\\cite{}` literally.";
    const doc = parseMarkdown(md);
    // No custom nodes should have been created inside the code span.
    let custom = 0;
    doc.descendants((n) => {
      if (["citation", "figure_embed", "latex_token", "author_note", "wiki_link"].includes(n.type.name)) custom += 1;
    });
    expect(custom).toBe(0);
    expect(roundtrip(md).trim()).toBe(md.trim());
  });

  it("does not eat reserved macros as author notes", () => {
    const doc = parseMarkdown("Keep \\textbf{bold} and \\section{x} literal.");
    let notes = 0;
    doc.descendants((n) => {
      if (n.type.name === "author_note") notes += 1;
    });
    expect(notes).toBe(0);
  });

  it("round-trips a mixed real-world paragraph", () => {
    const md = [
      "For each paragraph write the **draft** prose with [@cite_key], then approve.",
      "",
      "::figure[papers/treewriter-guide/figures/fig-workflow]",
      "",
      "See [[papers/slug/equations/name|Eq. (1)]] and \\ref{fig:workflow}.",
    ].join("\n");
    const once = roundtrip(md);
    // token presence (not strict equality, since list/whitespace may normalize)
    expect(once).toContain("[@cite_key]");
    expect(once).toContain("::figure[papers/treewriter-guide/figures/fig-workflow]");
    expect(once).toContain("[[papers/slug/equations/name|Eq. (1)]]");
    expect(once).toContain("\\ref{fig:workflow}");
    expect(roundtrip(once)).toBe(once); // idempotent
  });

  it("preserves strikethrough", () => expectStable("This is ~~gone~~ now."));
  it("preserves subscript", () => expectStable("Water is H~2~O here."));
  it("preserves superscript", () => expectStable("Einstein wrote E=mc^2^ once."));

  it("round-trips a task list", () => {
    const md = "* [ ] write tests\n\n* [x] ship it";
    const once = roundtrip(md);
    expect(once).toContain("[ ] write tests");
    expect(once).toContain("[x] ship it");
    expect(roundtrip(once)).toBe(once);
  });

  it("preserves inline code", () => expectStable("Run `npm test` now."));
  it("preserves a fenced code block", () => expectStable("```\nconst x = 1;\n```"));

  it("preserves nested emphasis + highlight", () => {
    const md = "A **bold \\hl{yellow}{spot}** end.";
    expect(roundtrip(md).trim()).toBe(md.trim());
  });
});
