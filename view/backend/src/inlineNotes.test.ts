import { describe, expect, it } from "vitest";

import {
  buildInlineNoteLatexPreamble,
  listInlineNoteAuthors,
  stripInlineNotes,
} from "./inlineNotes.js";

describe("stripInlineNotes", () => {
  it("removes LaTeX-style author notes", () => {
    expect(stripInlineNotes("Hello \\iy{fix} world")).toBe("Hello  world");
  });
});

describe("listInlineNoteAuthors", () => {
  it("collects unique author tags", () => {
    expect(listInlineNoteAuthors("\\iy{a} \\ak{b} \\iy{c}")).toEqual(["ak", "iy"]);
  });

  it("ignores todo macro", () => {
    expect(listInlineNoteAuthors("\\todo{x} \\iy{y}")).toEqual(["iy"]);
  });

  it("ignores latex and highlight commands", () => {
    expect(
      listInlineNoteAuthors(
        "\\ref{fig:a} \\hl{yellow}{text} \\textcolor{twyellow}{x} \\begin{figure} \\iy{note}",
      ),
    ).toEqual(["iy"]);
  });
});

describe("buildInlineNoteLatexPreamble", () => {
  it("emits providecommand for each author", () => {
    const preamble = buildInlineNoteLatexPreamble("\\iy{note} \\ak{other}");
    expect(preamble).toContain("\\providecommand{\\ak}");
    expect(preamble).toContain("\\providecommand{\\iy}");
    expect(preamble).not.toContain("\\providecommand{\\hl}");
    expect(preamble).not.toContain("\\providecommand{\\ref}");
  });

  it("returns empty string when no notes", () => {
    expect(buildInlineNoteLatexPreamble("plain text")).toBe("");
  });
});
