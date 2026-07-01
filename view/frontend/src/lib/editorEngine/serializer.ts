/** prosemirror-markdown serializer emitting the TreeWriter dialect. */
import { MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import type { Node as PMNode, Mark } from "prosemirror-model";

export const twMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    figure_embed(state, node: PMNode) {
      state.write(`::figure[${node.attrs.target as string}]`);
      state.closeBlock(node);
    },
    equation_embed(state, node: PMNode) {
      state.write(`::equation[${node.attrs.target as string}]`);
      state.closeBlock(node);
    },
    latex_token(state, node: PMNode) {
      state.text(`\\${node.attrs.kind as string}{${node.attrs.key as string}}`, false);
    },
    citation(state, node: PMNode) {
      const keys = node.attrs.keys as string;
      state.text(node.attrs.latex ? `\\cite{${keys}}` : `[${keys}]`, false);
    },
    wiki_link(state, node: PMNode) {
      const path = node.attrs.path as string;
      const label = node.attrs.label as string;
      state.text(label ? `[[${path}|${label}]]` : `[[${path}]]`, false);
    },
    author_note(state, node: PMNode) {
      state.text(`\\${node.attrs.author as string}{${node.attrs.text as string}}`, false);
    },
    list_item(state, node: PMNode) {
      if (node.attrs.checked !== null) state.write(`[${node.attrs.checked ? "x" : " "}] `);
      state.renderContent(node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    highlight: {
      open: (_state, mark: Mark) => `\\hl{${mark.attrs.color as string}}{`,
      close: "}",
      mixable: false,
      expelEnclosingWhitespace: true,
    },
    strikethrough: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    subscript: { open: "~", close: "~", mixable: true, expelEnclosingWhitespace: true },
    superscript: { open: "^", close: "^", mixable: true, expelEnclosingWhitespace: true },
  },
);
