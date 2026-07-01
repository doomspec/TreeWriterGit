/** Find & replace for the ProseMirror surface: match decorations + commands. */
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

export type FindMatch = { from: number; to: number };
type FindState = {
  query: string;
  caseSensitive: boolean;
  matches: FindMatch[];
  index: number;
};

export const findKey = new PluginKey<FindState>("twFindReplace");

const EMPTY: FindState = { query: "", caseSensitive: false, matches: [], index: 0 };

function findMatches(doc: PMNode, query: string, caseSensitive: boolean): FindMatch[] {
  const matches: FindMatch[] = [];
  if (!query) return matches;
  const needle = caseSensitive ? query : query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      matches.push({ from: pos + i, to: pos + i + query.length });
      i = hay.indexOf(needle, i + query.length);
    }
  });
  return matches;
}

export function findReplacePlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findKey,
    state: {
      init: () => EMPTY,
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(findKey) as
          | { type: "search"; query: string; caseSensitive: boolean }
          | { type: "step"; dir: number }
          | { type: "clear" }
          | undefined;
        if (meta?.type === "search") {
          const matches = findMatches(newState.doc, meta.query, meta.caseSensitive);
          return { query: meta.query, caseSensitive: meta.caseSensitive, matches, index: 0 };
        }
        if (meta?.type === "clear") return { ...EMPTY, caseSensitive: value.caseSensitive };
        if (meta?.type === "step" && value.matches.length) {
          const index = (value.index + meta.dir + value.matches.length) % value.matches.length;
          return { ...value, index };
        }
        if (tr.docChanged && value.query) {
          const matches = findMatches(newState.doc, value.query, value.caseSensitive);
          return { ...value, matches, index: Math.min(value.index, Math.max(0, matches.length - 1)) };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const s = findKey.getState(state);
        if (!s || !s.matches.length) return DecorationSet.empty;
        const decos = s.matches.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class: i === s.index ? "tw-find-match tw-find-current" : "tw-find-match",
          }),
        );
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

export function getFindState(view: EditorView): FindState {
  return findKey.getState(view.state) ?? EMPTY;
}

function selectCurrent(view: EditorView): void {
  const s = getFindState(view);
  if (!s.matches.length) return;
  const m = s.matches[s.index];
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView());
}

export function setFindQuery(view: EditorView, query: string, caseSensitive: boolean): void {
  view.dispatch(view.state.tr.setMeta(findKey, { type: "search", query, caseSensitive }));
}

export function stepFind(view: EditorView, dir: 1 | -1): void {
  view.dispatch(view.state.tr.setMeta(findKey, { type: "step", dir }));
  selectCurrent(view);
}

export function clearFind(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(findKey, { type: "clear" }));
}

export function replaceCurrent(view: EditorView, replacement: string): void {
  const s = getFindState(view);
  if (!s.matches.length) return;
  const m = s.matches[s.index];
  view.dispatch(view.state.tr.insertText(replacement, m.from, m.to));
}

export function replaceAll(view: EditorView, replacement: string): void {
  const s = getFindState(view);
  if (!s.matches.length) return;
  const tr = view.state.tr;
  // Apply from the end so earlier positions stay valid.
  for (let i = s.matches.length - 1; i >= 0; i -= 1) {
    tr.insertText(replacement, s.matches[i].from, s.matches[i].to);
  }
  view.dispatch(tr);
}
