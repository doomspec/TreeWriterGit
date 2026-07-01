/**
 * Inline pending-approval diff for the PM surface: highlights text inserted
 * since the approved baseline and shows removed text as strikethrough widgets.
 * Reuses the word-level diff from draftDiff.
 */
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

import { parseMarkdown } from "./roundtrip";

type Segment = { kind: "equal" | "insert" | "delete"; text: string };

/** Above this size, skip the O(n^2) LCS core and fall back to one delete + one insert. */
const LCS_CORE_LIMIT = 20_000;

/** Exact multi-region LCS diff over arbitrary tokens (chars, in our case), via classic DP. */
function lcsSegments(a: string[], b: string[]): Segment[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments: Segment[] = [];
  const push = (kind: Segment["kind"], ch: string) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else segments.push({ kind, text: ch });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", a[i]);
      i += 1;
    } else {
      push("insert", b[j]);
      j += 1;
    }
  }
  while (i < m) {
    push("delete", a[i]);
    i += 1;
  }
  while (j < n) {
    push("insert", b[j]);
    j += 1;
  }
  return segments;
}

/**
 * Exact character-level diff: trim the common prefix/suffix (cheap, and the
 * common case while typing has no other changes), then run a proper LCS diff
 * on the remaining "core". The LCS pass is what makes this correct for
 * multiple separate edits within one region (e.g. several citations inserted
 * at different points in the same paragraph) — a prefix/suffix trim alone
 * would treat everything between the first and last edit as one changed
 * blob, which is exactly wrong for scattered, otherwise-unrelated edits.
 */
function charDiff(before: string, after: string): Segment[] {
  if (before === after) return [{ kind: "equal", text: after }];
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before[p] === after[p]) p += 1;
  let sa = before.length;
  let sb = after.length;
  while (sa > p && sb > p && before[sa - 1] === after[sb - 1]) {
    sa -= 1;
    sb -= 1;
  }
  const beforeCore = before.slice(p, sa);
  const afterCore = after.slice(p, sb);

  const segments: Segment[] = [];
  if (p > 0) segments.push({ kind: "equal", text: after.slice(0, p) });
  if (beforeCore.length > LCS_CORE_LIMIT || afterCore.length > LCS_CORE_LIMIT) {
    // Pathological case (near-total rewrite with no shared ends): skip the
    // O(n^2) LCS pass rather than risk hanging on a huge document.
    if (beforeCore) segments.push({ kind: "delete", text: beforeCore });
    if (afterCore) segments.push({ kind: "insert", text: afterCore });
  } else {
    segments.push(...lcsSegments([...beforeCore], [...afterCore]));
  }
  if (after.length - sb > 0) segments.push({ kind: "equal", text: after.slice(sb) });
  return segments;
}

type DiffState = { baseText: string | null };

export const pendingDiffKey = new PluginKey<DiffState>("twPendingDiff");

type CharPos = { ch: string; pos: number };

/** Flatten a doc's text into chars tagged with their ProseMirror positions. */
function charPositions(doc: PMNode): CharPos[] {
  const chars: CharPos[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let k = 0; k < node.text.length; k += 1) chars.push({ ch: node.text[k], pos: pos + k });
    }
  });
  return chars;
}

function docPlainText(doc: PMNode): string {
  return charPositions(doc)
    .map((c) => c.ch)
    .join("");
}

function deletionWidget(text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "tw-diff-del";
  span.contentEditable = "false";
  span.textContent = text;
  return span;
}

function computeDecorations(doc: PMNode, baseText: string | null): DecorationSet {
  if (baseText == null) return DecorationSet.empty;
  const chars = charPositions(doc);
  const current = chars.map((c) => c.ch).join("");
  if (current === baseText) return DecorationSet.empty;

  const segments = charDiff(baseText, current);
  const decos: Decoration[] = [];
  let ci = 0;
  for (const seg of segments) {
    const len = seg.text.length;
    if (seg.kind === "equal") {
      ci += len;
    } else if (seg.kind === "insert") {
      if (len > 0 && chars[ci]) {
        const from = chars[ci].pos;
        const to = chars[ci + len - 1].pos + 1;
        decos.push(Decoration.inline(from, to, { class: "tw-diff-ins" }));
      }
      ci += len;
    } else {
      // deletion: text is not present in the current doc — show it as a widget.
      const pos = chars[ci]?.pos ?? (chars.length ? chars[chars.length - 1].pos + 1 : 1);
      decos.push(Decoration.widget(pos, () => deletionWidget(seg.text), { side: -1, ignoreSelection: true }));
    }
  }
  return DecorationSet.create(doc, decos);
}

export function pendingDiffPlugin(): Plugin<DiffState> {
  return new Plugin<DiffState>({
    key: pendingDiffKey,
    state: {
      init: () => ({ baseText: null }),
      apply(tr, value) {
        const meta = tr.getMeta(pendingDiffKey) as
          | { type: "baseline"; markdown: string }
          | { type: "clear" }
          | undefined;
        if (meta?.type === "baseline") return { baseText: docPlainText(parseMarkdown(meta.markdown)) };
        if (meta?.type === "clear") return { baseText: null };
        return value;
      },
    },
    props: {
      decorations(state) {
        return computeDecorations(state.doc, pendingDiffKey.getState(state)?.baseText ?? null);
      },
    },
  });
}

export function setPendingDiffBaseline(view: EditorView, markdown: string | null): void {
  const meta = markdown == null ? { type: "clear" as const } : { type: "baseline" as const, markdown };
  view.dispatch(view.state.tr.setMeta(pendingDiffKey, meta));
}
