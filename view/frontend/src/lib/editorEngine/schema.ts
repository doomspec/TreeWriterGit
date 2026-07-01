/**
 * ProseMirror schema for the TreeWriter markdown engine (Stage 4 spike).
 *
 * Extends prosemirror-markdown's base schema with first-class nodes/marks for
 * TreeWriter's custom dialect, so the markdown round-trip is handled by real
 * parser/serializer rules instead of the legacy code-span smuggling
 * (`⟦author:…⟧`, `§cite:…§`) used by the marked + turndown pipeline.
 *
 * Custom syntax preserved:
 *   - \hl{color}{text}      -> highlight mark (color attr)
 *   - \author{text}         -> author_note inline leaf (author + text attrs)
 *     (any non-reserved \name{...} macro; see RESERVED_INLINE_MACROS)
 *   - \label{key} \ref{key} -> latex_token inline leaf (kind + key)
 *   - \cite{key} / [@key]   -> citation inline leaf (keys)
 *   - [[path|label]]        -> wiki_link inline leaf (path + label)
 *   - ::figure[target]      -> figure_embed block leaf (target)
 *   - ::equation[target]    -> equation_embed block leaf (target)
 */
import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";

import { formatChord } from "@/lib/keyboardChords";

/** Hover hint: navigation requires a modifier click; a plain click edits. */
const OPEN_HINT = `${formatChord("mod+click")} to open`;

const figureEmbed: NodeSpec = {
  group: "block",
  atom: true,
  attrs: { target: { default: "" } },
  parseDOM: [{ tag: "div[data-figure-embed]", getAttrs: (el) => ({ target: (el as HTMLElement).getAttribute("data-figure-embed") ?? "" }) }],
  toDOM: (node) => ["div", { "data-figure-embed": node.attrs.target as string, title: OPEN_HINT }, 0],
};

const equationEmbed: NodeSpec = {
  group: "block",
  atom: true,
  attrs: { target: { default: "" } },
  parseDOM: [{ tag: "div[data-equation-embed]", getAttrs: (el) => ({ target: (el as HTMLElement).getAttribute("data-equation-embed") ?? "" }) }],
  toDOM: (node) => ["div", { "data-equation-embed": node.attrs.target as string, title: OPEN_HINT }, 0],
};

const latexToken: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: { kind: { default: "ref" }, key: { default: "" } },
  parseDOM: [
    {
      tag: "span[data-latex-token]",
      getAttrs: (el) => ({
        kind: (el as HTMLElement).getAttribute("data-latex-token") ?? "ref",
        key: (el as HTMLElement).getAttribute("data-key") ?? "",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    { "data-latex-token": node.attrs.kind as string, "data-key": node.attrs.key as string },
    `\\${node.attrs.kind}{${node.attrs.key}}`,
  ],
};

const citation: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  // `keys` holds the raw, semicolon-joined cite keys (no @). `latex` records
  // whether the source used \cite{} (true) or pandoc [@key] (false).
  attrs: { keys: { default: "" }, latex: { default: false } },
  parseDOM: [
    {
      tag: "span[data-citation]",
      getAttrs: (el) => ({
        keys: (el as HTMLElement).getAttribute("data-citation") ?? "",
        latex: (el as HTMLElement).getAttribute("data-latex") === "true",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    { "data-citation": node.attrs.keys as string, "data-latex": String(node.attrs.latex), title: `${formatChord("mod+click")} to open reference` },
    // Pandoc keys already carry '@'; latex \cite keys do not.
    node.attrs.latex ? `@${node.attrs.keys}` : `${node.attrs.keys}`,
  ],
};

const wikiLink: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: { path: { default: "" }, label: { default: "" } },
  parseDOM: [
    {
      tag: "a[data-wikilink]",
      getAttrs: (el) => ({
        path: (el as HTMLElement).getAttribute("data-wikilink") ?? "",
        label: (el as HTMLElement).textContent ?? "",
      }),
    },
  ],
  toDOM: (node) => ["a", { "data-wikilink": node.attrs.path as string, title: OPEN_HINT }, (node.attrs.label as string) || (node.attrs.path as string)],
};

const authorNote: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: { author: { default: "note" }, text: { default: "" } },
  parseDOM: [
    {
      tag: "span[data-author-note]",
      getAttrs: (el) => ({
        author: (el as HTMLElement).getAttribute("data-author-note") ?? "note",
        text: (el as HTMLElement).getAttribute("data-text") ?? "",
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    { "data-author-note": node.attrs.author as string, "data-text": node.attrs.text as string },
    `\\${node.attrs.author}{${node.attrs.text}}`,
  ],
};

// Standard markdown links: reuse the base spec but add the open-hint tooltip.
const baseLink = baseSchema.spec.marks.get("link") as MarkSpec;
const link: MarkSpec = {
  ...baseLink,
  toDOM: (mark) => ["a", { href: mark.attrs.href as string, title: OPEN_HINT }, 0],
};

const highlight: MarkSpec = {
  attrs: { color: { default: "yellow" } },
  parseDOM: [{ tag: "mark[data-hl]", getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute("data-hl") ?? "yellow" }) }],
  toDOM: (mark) => ["mark", { "data-hl": mark.attrs.color as string }, 0],
};

const strikethrough: MarkSpec = {
  parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }, { style: "text-decoration=line-through" }],
  toDOM: () => ["s", 0],
};

const subscript: MarkSpec = {
  excludes: "superscript",
  parseDOM: [{ tag: "sub" }],
  toDOM: () => ["sub", 0],
};

const superscript: MarkSpec = {
  excludes: "subscript",
  parseDOM: [{ tag: "sup" }],
  toDOM: () => ["sup", 0],
};

// Task list items carry a `checked` attr (null = plain bullet item).
const baseListItem = baseSchema.spec.nodes.get("list_item") as NodeSpec;
const listItem: NodeSpec = {
  ...baseListItem,
  attrs: { checked: { default: null } },
  toDOM: (node) =>
    node.attrs.checked === null
      ? ["li", 0]
      : ["li", { "data-task": "", "data-checked": String(node.attrs.checked) }, 0],
};

export const twSchema = new Schema({
  nodes: baseSchema.spec.nodes
    .addToEnd("figure_embed", figureEmbed)
    .addToEnd("equation_embed", equationEmbed)
    .addToEnd("latex_token", latexToken)
    .addToEnd("citation", citation)
    .addToEnd("wiki_link", wikiLink)
    .addToEnd("author_note", authorNote)
    .update("list_item", listItem),
  marks: baseSchema.spec.marks
    .update("link", link)
    .addToEnd("highlight", highlight)
    .addToEnd("strikethrough", strikethrough)
    .addToEnd("subscript", subscript)
    .addToEnd("superscript", superscript),
});
