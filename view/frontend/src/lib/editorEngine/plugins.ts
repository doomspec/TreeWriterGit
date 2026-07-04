/** ProseMirror plugin set for the TreeWriter markdown editor (Stage 5). */
import { baseKeymap, toggleMark, setBlockType, wrapIn } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { inputRules, wrappingInputRule, textblockTypeInputRule, smartQuotes, ellipsis } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { splitListItem, liftListItem, sinkListItem, wrapInList } from "prosemirror-schema-list";
import type { Plugin } from "prosemirror-state";
import { gapCursor } from "prosemirror-gapcursor";

import { findReplacePlugin } from "./findReplace";
import { pendingDiffPlugin } from "./pendingDiff";
import { twSchema } from "./schema";

const marks = twSchema.marks;
const nodes = twSchema.nodes;

function buildKeymap(): Plugin {
  const listItem = nodes.list_item;
  return keymap({
    "Mod-b": toggleMark(marks.strong),
    "Mod-i": toggleMark(marks.em),
    "Mod-`": toggleMark(marks.code),
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo,
    "Shift-Ctrl-8": wrapInList(nodes.bullet_list),
    "Shift-Ctrl-9": wrapInList(nodes.ordered_list),
    "Ctrl->": wrapIn(nodes.blockquote),
    "Shift-Ctrl-0": setBlockType(nodes.paragraph),
    Enter: splitListItem(listItem),
    Tab: sinkListItem(listItem),
    "Shift-Tab": liftListItem(listItem),
  });
}

function buildInputRules(): Plugin {
  const rules = [
    ...smartQuotes,
    ellipsis,
    // "> " -> blockquote
    wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
    // "1. " -> ordered list
    wrappingInputRule(
      /^(\d+)\.\s$/,
      nodes.ordered_list,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + (node.attrs.order as number) === Number(match[1]),
    ),
    // "- " / "* " / "+ " -> bullet list
    wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list),
    // "``` " -> code block
    textblockTypeInputRule(/^```$/, nodes.code_block),
    // "# " ... "###### " -> heading
    textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (match) => ({ level: match[1].length })),
  ];
  return inputRules({ rules });
}

export function twEditorPlugins(): Plugin[] {
  return [pendingDiffPlugin(), findReplacePlugin(), buildInputRules(), buildKeymap(), keymap(baseKeymap), gapCursor(), history()];
}
