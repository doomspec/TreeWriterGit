/** prosemirror-markdown parser wired with the TreeWriter dialect tokens. */
import MarkdownIt from "markdown-it";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import { MarkdownParser, defaultMarkdownParser } from "prosemirror-markdown";

import { treewriterDialect } from "./dialect";
import { twSchema } from "./schema";

const md = MarkdownIt("commonmark", { html: false })
  .enable("strikethrough")
  .use(markdownItSub)
  .use(markdownItSup)
  .use(treewriterDialect);

type Tok = { meta?: Record<string, unknown>; attrGet?: (name: string) => string | null };

function checkedAttr(tok: Tok): { checked: boolean | null } {
  const raw = tok.attrGet?.("checked") ?? null;
  return { checked: raw === null ? null : raw === "true" };
}

export const twMarkdownParser = new MarkdownParser(twSchema, md, {
  ...defaultMarkdownParser.tokens,
  s: { mark: "strikethrough" },
  sub: { mark: "subscript" },
  sup: { mark: "superscript" },
  list_item: { block: "list_item", getAttrs: (t: Tok) => checkedAttr(t) },
  tw_wikilink: { node: "wiki_link", getAttrs: (t: Tok) => ({ path: t.meta?.path ?? "", label: t.meta?.label ?? "" }) },
  tw_citation: {
    node: "citation",
    getAttrs: (t: Tok) => ({ keys: t.meta?.keys ?? "", latex: t.meta?.source === "latex" }),
  },
  tw_latex_token: { node: "latex_token", getAttrs: (t: Tok) => ({ kind: t.meta?.kind ?? "ref", key: t.meta?.key ?? "" }) },
  tw_author_note: { node: "author_note", getAttrs: (t: Tok) => ({ author: t.meta?.author ?? "note", text: t.meta?.text ?? "" }) },
  tw_figure: { node: "figure_embed", getAttrs: (t: Tok) => ({ target: t.meta?.target ?? "" }) },
  tw_equation: { node: "equation_embed", getAttrs: (t: Tok) => ({ target: t.meta?.target ?? "" }) },
  tw_hl: { mark: "highlight", getAttrs: (t: Tok) => ({ color: t.meta?.color ?? "yellow" }) },
});
