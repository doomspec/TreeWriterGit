import { findNode, folderNodeKind, isUnitFolder, type PaperSectionItem } from "./modelTree";
import type { ModelNode } from "./modelTreeTypes";

export type SectionTreeRow =
  | { type: "item"; item: PaperSectionItem }
  | { type: "units-under-subsection"; subsection: PaperSectionItem; units: PaperSectionItem[] };

function isSubsectionRow(node: ModelNode | null): boolean {
  return folderNodeKind(node) === "subsection";
}

/** Group consecutive unit siblings that follow a subsection in section child_order. */
export function groupSectionTreeRows(
  items: PaperSectionItem[],
  tree: ModelNode[],
): SectionTreeRow[] {
  const rows: SectionTreeRow[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    const node = findNode(tree, item.path);

    if (isSubsectionRow(node)) {
      rows.push({ type: "item", item });
      const units: PaperSectionItem[] = [];
      let next = index + 1;
      while (next < items.length) {
        const sibling = items[next];
        if (!isUnitFolder(findNode(tree, sibling.path))) break;
        units.push(sibling);
        next += 1;
      }
      if (units.length > 0) {
        rows.push({ type: "units-under-subsection", subsection: item, units });
        index = next;
        continue;
      }
    }

    rows.push({ type: "item", item });
    index += 1;
  }

  return rows;
}
