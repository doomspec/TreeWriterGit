/** @vitest-environment jsdom */
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { beforeAll, describe, expect, it } from "vitest";

import { findKey, findReplacePlugin, replaceAll, replaceCurrent, setFindQuery } from "./findReplace";
import { parseMarkdown, serializeMarkdown } from "./roundtrip";
import { twEditorPlugins } from "./plugins";

beforeAll(() => {
  const rects = () => Object.assign([] as unknown[], { item: () => null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getClientRects = rects;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).getClientRects = rects;
});

function mountView(markdown: string): EditorView {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const state = EditorState.create({ doc: parseMarkdown(markdown), plugins: twEditorPlugins() });
  return new EditorView(host, { state });
}

function searchState(markdown: string, query: string, caseSensitive = false) {
  const state = EditorState.create({ doc: parseMarkdown(markdown), plugins: [findReplacePlugin()] });
  const next = state.apply(state.tr.setMeta(findKey, { type: "search", query, caseSensitive }));
  return { state: next, find: findKey.getState(next)! };
}

describe("find & replace plugin", () => {
  it("finds all case-insensitive matches", () => {
    const { find } = searchState("Foo and foo and FOO", "foo");
    expect(find.matches.length).toBe(3);
    expect(find.index).toBe(0);
  });

  it("respects case sensitivity", () => {
    const { find } = searchState("Foo and foo and FOO", "foo", true);
    expect(find.matches.length).toBe(1);
  });

  it("steps the current index with wraparound", () => {
    const { state, find } = searchState("a a a", "a");
    expect(find.matches.length).toBe(3);
    const stepped = state.apply(state.tr.setMeta(findKey, { type: "step", dir: -1 }));
    expect(findKey.getState(stepped)!.index).toBe(2); // wraps from 0 to last
  });

  it("clears matches", () => {
    const { state } = searchState("foo foo", "foo");
    const cleared = state.apply(state.tr.setMeta(findKey, { type: "clear" }));
    expect(findKey.getState(cleared)!.matches.length).toBe(0);
  });

  it("recomputes matches after a doc edit", () => {
    const { state } = searchState("foo foo", "foo");
    // delete the first "foo " (positions 1..5 in the paragraph)
    const edited = state.apply(state.tr.delete(1, 5));
    expect(findKey.getState(edited)!.matches.length).toBe(1);
  });

  it("replaceCurrent replaces the active match in a live view", () => {
    const view = mountView("foo bar foo");
    setFindQuery(view, "foo", false);
    replaceCurrent(view, "baz");
    expect(serializeMarkdown(view.state.doc)).toContain("baz bar foo");
    view.destroy();
  });

  it("replaceAll replaces every match in a live view", () => {
    const view = mountView("foo bar foo");
    setFindQuery(view, "foo", false);
    replaceAll(view, "baz");
    expect(serializeMarkdown(view.state.doc)).toContain("baz bar baz");
    view.destroy();
  });
});
