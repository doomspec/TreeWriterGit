/**
 * Inline pending-approval diff for the PM surface: highlights text inserted
 * since the approved baseline and shows removed text as strikethrough widgets.
 * Diffs at word granularity (see wordDiff) so rewritten paragraphs stay
 * readable instead of dissolving into character-level noise.
 */
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

import { parseMarkdown } from "./roundtrip";

type Segment = { kind: "equal" | "insert" | "delete"; text: string };

/**
 * Above this many tokens per side, skip the O(n*m) LCS core and fall back to
 * one delete + one insert. Tokens are words/whitespace runs, so this covers a
 * very large section before the quadratic DP becomes a concern.
 */
const LCS_TOKEN_LIMIT = 3_000;

type DiffToken = { raw: string; key: string };

/**
 * Word-level tokens: whitespace runs and non-whitespace runs alternate. The
 * `key` strips surrounding punctuation and lowercases so that trivial edits
 * (case, trailing comma) still match as "equal" — same normalization the
 * line-based draft diff uses in lib/draftDiff.ts.
 */
function normalizeTokenKey(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .toLowerCase();
}

function tokenize(text: string): DiffToken[] {
  const parts = text.match(/\S+|\s+/g) ?? [];
  return parts.map((raw) => ({ raw, key: /\s/.test(raw) ? raw : normalizeTokenKey(raw) || raw }));
}

function pushSegment(segments: Segment[], kind: Segment["kind"], text: string): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === kind) last.text += text;
  else segments.push({ kind, text });
}

/**
 * Character-level LCS, used ONLY to refine a single matched word pair whose
 * raw text differs (e.g. "hello" -> "hello!", where the token keys are equal
 * because punctuation is normalized out). Safe here because it runs over one
 * short word, never across a whole paragraph. Emits after-text on equal so
 * equal+insert still reconstructs the current word exactly.
 */
function refineToken(before: string, after: string, out: Segment[]): void {
  if (before === after) {
    pushSegment(out, "equal", after);
    return;
  }
  const a = [...before];
  const b = [...after];
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      pushSegment(out, "equal", b[j]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSegment(out, "delete", a[i]);
      i += 1;
    } else {
      pushSegment(out, "insert", b[j]);
      j += 1;
    }
  }
  while (i < m) {
    pushSegment(out, "delete", a[i]);
    i += 1;
  }
  while (j < n) {
    pushSegment(out, "insert", b[j]);
    j += 1;
  }
}

/**
 * Multi-region LCS diff over word tokens, via classic DP. Equal matches emit
 * the AFTER token's raw text so that the concatenation of every equal+insert
 * segment reconstructs the current document exactly — the position mapping in
 * computeDecorations relies on that invariant.
 */
function lcsTokenSegments(a: DiffToken[], b: DiffToken[]): Segment[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments: Segment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i].key === b[j].key) {
      // Matched by normalized key; refine at char level so a punctuation- or
      // case-only difference within the word (e.g. "hello" -> "hello!") still
      // shows, while identical words stay a plain equal segment.
      refineToken(a[i].raw, b[j].raw, segments);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSegment(segments, "delete", a[i].raw);
      i += 1;
    } else {
      pushSegment(segments, "insert", b[j].raw);
      j += 1;
    }
  }
  while (i < m) {
    pushSegment(segments, "delete", a[i].raw);
    i += 1;
  }
  while (j < n) {
    pushSegment(segments, "insert", b[j].raw);
    j += 1;
  }
  return segments;
}

/**
 * Word-level diff: trim the common leading/trailing tokens (cheap, and the
 * common case while typing changes only one region), then run a proper LCS
 * diff on the remaining "core". Diffing whole words rather than characters is
 * what keeps a rewritten paragraph readable — a character-level LCS matches
 * scattered single letters and interleaves insertions/deletions into
 * unreadable noise. The LCS pass over the core still resolves multiple
 * separate edits within one region correctly (e.g. several citations inserted
 * at different points in the same paragraph).
 */
function wordDiff(before: string, after: string): Segment[] {
  if (before === after) return [{ kind: "equal", text: after }];
  const a = tokenize(before);
  const b = tokenize(after);

  // Trim on exact raw equality (not just key): a key-only match still needs
  // char refinement, so it must fall through to the LCS core below.
  let p = 0;
  const maxPre = Math.min(a.length, b.length);
  while (p < maxPre && a[p].raw === b[p].raw) p += 1;
  let sa = a.length;
  let sb = b.length;
  while (sa > p && sb > p && a[sa - 1].raw === b[sb - 1].raw) {
    sa -= 1;
    sb -= 1;
  }

  const segments: Segment[] = [];
  for (let k = 0; k < p; k += 1) pushSegment(segments, "equal", b[k].raw);

  const aCore = a.slice(p, sa);
  const bCore = b.slice(p, sb);
  if (aCore.length > LCS_TOKEN_LIMIT || bCore.length > LCS_TOKEN_LIMIT) {
    // Pathological case (near-total rewrite with no shared ends): skip the
    // O(n*m) LCS pass rather than risk hanging on a huge document.
    pushSegment(segments, "delete", aCore.map((t) => t.raw).join(""));
    pushSegment(segments, "insert", bCore.map((t) => t.raw).join(""));
  } else {
    for (const seg of lcsTokenSegments(aCore, bCore)) pushSegment(segments, seg.kind, seg.text);
  }

  for (let k = sb; k < b.length; k += 1) pushSegment(segments, "equal", b[k].raw);
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

  const segments = wordDiff(baseText, current);
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
