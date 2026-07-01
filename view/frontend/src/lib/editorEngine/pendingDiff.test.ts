/** @vitest-environment jsdom */
import { EditorState } from "prosemirror-state";
import type { DecorationSet } from "prosemirror-view";
import { describe, expect, it } from "vitest";

import { pendingDiffKey, pendingDiffPlugin } from "./pendingDiff";
import { parseMarkdown } from "./roundtrip";

function decorations(markdown: string, baseline: string | null): DecorationSet {
  const plugin = pendingDiffPlugin();
  const state = EditorState.create({ doc: parseMarkdown(markdown), plugins: [plugin] });
  const next =
    baseline == null
      ? state
      : state.apply(state.tr.setMeta(pendingDiffKey, { type: "baseline", markdown: baseline }));
  return (plugin.props.decorations as (s: typeof next) => DecorationSet)(next);
}

describe("pending diff plugin", () => {
  it("no decorations without a baseline", () => {
    expect(decorations("hello world", null).find().length).toBe(0);
  });

  it("no decorations when current equals baseline", () => {
    expect(decorations("same text", "same text").find().length).toBe(0);
  });

  it("decorates an insertion", () => {
    expect(decorations("hello brave world", "hello world").find().length).toBeGreaterThan(0);
  });

  it("produces a decoration when text was removed", () => {
    expect(decorations("hello world", "hello brave world").find().length).toBeGreaterThan(0);
  });

  it("highlights an appended char including trailing punctuation", () => {
    // word-level diff strips trailing punctuation from token keys and would
    // miss this; the char diff must decorate the '!'.
    const set = decorations("hello!", "hello");
    const found = set.find();
    expect(found.length).toBe(1);
    // the decoration covers the last character
    expect(found[0].to).toBe(found[0].from + 1);
  });

  it("only decorates the inserted spans, not the untouched text between two scattered insertions", () => {
    // Two citations inserted at different points in the same paragraph — a
    // naive prefix/suffix trim would flag everything between the first and
    // last edit as changed, including the untouched "two three four" run.
    const baseline = "one two three four five";
    const current = "one INS1 two three four INS2 five";
    const set = decorations(current, baseline);
    const inline = set.find().filter((d) => d.to !== d.from); // inline insert spans, excludes delete widgets
    const insertedLen = inline.reduce((sum, d) => sum + (d.to - d.from), 0);
    expect(insertedLen).toBe("INS1 ".length + "INS2 ".length);
    // Critically, the untouched middle run must NOT be covered by any decoration.
    const middleStart = current.indexOf("two three four");
    const middleEnd = middleStart + "two three four".length;
    for (const d of inline) {
      const overlapsMiddle = d.from < middleEnd + 1 && d.to > middleStart + 1; // +1 for doc offset
      expect(overlapsMiddle).toBe(false);
    }
  });

  it("marks a whole new sentence inserted mid-paragraph without bleeding into neighbors", () => {
    const baseline = "Start here. End here.";
    const current = "Start here. A brand new sentence. End here.";
    const set = decorations(current, baseline);
    const inline = set.find().filter((d) => d.to !== d.from);
    const insertedLen = inline.reduce((sum, d) => sum + (d.to - d.from), 0);
    expect(insertedLen).toBe("A brand new sentence. ".length);
  });

  it("diffs a rewritten sentence at word boundaries, not mid-word (no char-level noise)", () => {
    // A char-level LCS matches scattered single letters between the two
    // strings and interleaves tiny insert/delete fragments — the garbled
    // "modulacreates rnew" effect. Word-level keeps shared words equal and
    // only decorates the words that actually changed.
    const baseline = "creates new opportunities for autonomous bioengineering";
    const current = "creates many new opportunities for automated bioengineering platforms";
    const set = decorations(current, baseline);
    const inline = set.find().filter((d) => d.to !== d.from);
    // Unchanged words must not be covered by any inline (insert) decoration.
    const docText = current;
    for (const word of ["creates", "opportunities", "for", "bioengineering"]) {
      const start = docText.indexOf(word) + 1; // +1 for the doc's opening offset
      const end = start + word.length;
      for (const d of inline) {
        const overlaps = d.from < end && d.to > start;
        expect(overlaps).toBe(false);
      }
    }
    // The genuinely new/changed words ("many ", "automated", " platforms")
    // are the only inserted content.
    const insertedLen = inline.reduce((sum, d) => sum + (d.to - d.from), 0);
    expect(insertedLen).toBe("many ".length + "automated".length + " platforms".length);
  });
});
