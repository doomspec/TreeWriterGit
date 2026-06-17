import { describe, expect, it } from "vitest";

import {
  authorNoteMacro,
  listInlineNotes,
  parseInlineNoteCodeSpan,
  preprocessInlineNotesForMarkdown,
  stripInlineNotes,
  wrapInlineNote,
} from "./inlineNotes";

describe("authorNoteMacro", () => {
  it("derives initials from full name", () => {
    expect(authorNoteMacro("Ivan Yakavets")).toBe("iy");
  });

  it("uses first two letters for single name", () => {
    expect(authorNoteMacro("Alice")).toBe("al");
  });
});

describe("wrapInlineNote", () => {
  it("wraps selection in LaTeX-style macro", () => {
    expect(wrapInlineNote("iy", "check this")).toBe("\\iy{check this}");
  });

  it("uses placeholder when selection is empty", () => {
    expect(wrapInlineNote("iy", "")).toBe("\\iy{…}");
  });
});

describe("preprocessInlineNotesForMarkdown", () => {
  it("encodes notes as code spans for remark", () => {
    const input = "Text \\iy{suggestion} here.";
    expect(preprocessInlineNotesForMarkdown(input)).toBe("Text `⟦iy:suggestion⟧` here.");
  });
});

describe("parseInlineNoteCodeSpan", () => {
  it("parses encoded note spans", () => {
    expect(parseInlineNoteCodeSpan("⟦ak:revise intro⟧")).toEqual({
      author: "ak",
      text: "revise intro",
    });
  });
});

describe("stripInlineNotes", () => {
  it("removes author macros from draft text", () => {
    const input = "Claim \\iy{needs cite} is strong.";
    expect(stripInlineNotes(input)).toBe("Claim  is strong.");
  });
});

describe("listInlineNotes", () => {
  it("finds all inline notes with positions", () => {
    const input = "\\iy{a} and \\ak{b}";
    expect(listInlineNotes(input)).toEqual([
      { author: "iy", text: "a", index: 0 },
      { author: "ak", text: "b", index: 11 },
    ]);
  });
});
