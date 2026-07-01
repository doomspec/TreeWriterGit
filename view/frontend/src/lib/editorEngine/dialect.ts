/**
 * markdown-it plugin adding TreeWriter's custom inline/block syntax as real
 * tokens, consumed by the prosemirror-markdown parser (see parser.ts).
 *
 * Replaces the legacy preprocess/encode/restore code-span smuggling.
 */
import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

import { RESERVED_INLINE_MACROS } from "@/lib/inlineNotes";

const HL_COLORS = new Set(["yellow", "green", "blue", "pink", "orange", "purple"]);

/** Read a single `{...}` brace group at `src[from]` (must be '{'). Returns end index past '}' and inner, or null. */
function readBraceGroup(src: string, from: number): { inner: string; end: number } | null {
  if (src[from] !== "{") return null;
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { inner: src.slice(from + 1, i), end: i + 1 };
    }
  }
  return null;
}

function inlineMacros(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  const ch = src[start];

  // [[path|label]] wikilink, and [@key; @key2] pandoc citation
  if (ch === "[") {
    if (src[start + 1] === "[") {
      const close = src.indexOf("]]", start + 2);
      if (close === -1) return false;
      const body = src.slice(start + 2, close);
      if (body.includes("[") || body.includes("\n")) return false;
      if (!silent) {
        const pipe = body.indexOf("|");
        const path = (pipe === -1 ? body : body.slice(0, pipe)).trim();
        const label = pipe === -1 ? "" : body.slice(pipe + 1).trim();
        const token = state.push("tw_wikilink", "", 0);
        token.meta = { path, label };
      }
      state.pos = close + 2;
      return true;
    }
    if (src[start + 1] === "@") {
      const close = src.indexOf("]", start + 1);
      if (close === -1) return false;
      const inner = src.slice(start + 1, close); // includes leading @, e.g. "@a; @b"
      if (inner.includes("\n") || inner.includes("[")) return false;
      if (!silent) {
        const token = state.push("tw_citation", "", 0);
        token.meta = { keys: inner, source: "pandoc" };
      }
      state.pos = close + 1;
      return true;
    }
    return false;
  }

  if (ch !== "\\") return false;

  // \hl{color}{text} highlight
  const rest = src.slice(start);
  const hl = /^\\hl\{/.exec(rest);
  if (hl) {
    const g1 = readBraceGroup(src, start + 3);
    if (!g1) return false;
    const g2 = readBraceGroup(src, g1.end);
    if (!g2) return false;
    const color = HL_COLORS.has(g1.inner.trim()) ? g1.inner.trim() : "yellow";
    if (!silent) {
      const open = state.push("tw_hl_open", "mark", 1);
      open.meta = { color };
      const text = state.push("text", "", 0);
      text.content = g2.inner;
      state.push("tw_hl_close", "mark", -1);
    }
    state.pos = g2.end;
    return true;
  }

  // \label{key} \ref{key} \cite{keys}
  const named = /^\\([a-zA-Z]{1,12})\{/.exec(rest);
  if (!named) return false;
  const macro = named[1];
  const group = readBraceGroup(src, start + 1 + macro.length);
  if (!group) return false;

  if (macro === "label" || macro === "ref") {
    if (!silent) {
      const token = state.push("tw_latex_token", "", 0);
      token.meta = { kind: macro, key: group.inner };
    }
    state.pos = group.end;
    return true;
  }
  if (macro === "cite") {
    if (!silent) {
      const token = state.push("tw_citation", "", 0);
      token.meta = { keys: group.inner, source: "latex" };
    }
    state.pos = group.end;
    return true;
  }

  // Reserved LaTeX/asset macros pass through as literal text (not author notes).
  if (RESERVED_INLINE_MACROS.has(macro.toLowerCase())) return false;

  // Any other \name{...} is a per-author inline note.
  if (!silent) {
    const token = state.push("tw_author_note", "", 0);
    token.meta = { author: macro, text: group.inner };
  }
  state.pos = group.end;
  return true;
}

const EMBED_RE = /^::(figure|equation)\[([^\]]*)\]\s*$/;

function blockEmbeds(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const line = state.src.slice(start, max);
  const match = EMBED_RE.exec(line);
  if (!match) return false;
  if (silent) return true;
  const token = state.push(match[1] === "figure" ? "tw_figure" : "tw_equation", "", 0);
  token.meta = { target: match[2].trim() };
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

const TASK_RE = /^\[([ xX])\]\s+/;

/**
 * Detect `[ ] ` / `[x] ` at the start of a list item and lift it to a `checked`
 * attr on the list_item_open token, stripping the marker from the rendered text.
 */
function taskListCore(state: { tokens: Array<Record<string, unknown>> }): void {
  const tokens = state.tokens as Array<{
    type: string;
    content: string;
    children?: Array<{ type: string; content: string }> | null;
    attrSet: (name: string, value: string) => void;
  }>;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== "list_item_open") continue;
    // list_item_open, paragraph_open, inline, ...
    const inline = tokens[i + 2];
    if (!inline || inline.type !== "inline") continue;
    const match = TASK_RE.exec(inline.content);
    if (!match) continue;
    tokens[i].attrSet("checked", match[1].toLowerCase() === "x" ? "true" : "false");
    inline.content = inline.content.slice(match[0].length);
    const firstText = inline.children?.find((c) => c.type === "text");
    if (firstText) firstText.content = firstText.content.replace(TASK_RE, "");
  }
}

export function treewriterDialect(md: MarkdownIt): void {
  md.inline.ruler.before("escape", "tw_inline_macros", inlineMacros);
  md.block.ruler.before("paragraph", "tw_block_embeds", blockEmbeds, {
    alt: ["paragraph", "blockquote", "list"],
  });
  md.core.ruler.after("inline", "tw_task_list", (state) => {
    taskListCore(state as unknown as { tokens: Array<Record<string, unknown>> });
    return true;
  });
}
