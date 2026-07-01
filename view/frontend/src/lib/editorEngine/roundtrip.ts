/** Headless markdown <-> ProseMirror round-trip helpers (Stage 4 spike). */
import type { Node as PMNode } from "prosemirror-model";

import { twMarkdownParser } from "./parser";
import { twMarkdownSerializer } from "./serializer";

export function parseMarkdown(markdown: string): PMNode {
  const doc = twMarkdownParser.parse(markdown);
  if (!doc) throw new Error("twMarkdownParser returned null");
  return doc;
}

export function serializeMarkdown(doc: PMNode): string {
  return twMarkdownSerializer.serialize(doc);
}

/** Parse then serialize. Normalizes formatting; preserves all custom tokens. */
export function roundtrip(markdown: string): string {
  return serializeMarkdown(parseMarkdown(markdown));
}
