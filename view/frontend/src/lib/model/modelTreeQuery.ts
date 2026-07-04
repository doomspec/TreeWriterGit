import type { ModelNode } from "./modelTreeTypes";
import {
  DRAFT_DOC,
  INDEX_DOC,
  OUTLINE_DOC,
  isHiddenModelFile,
  parentPath,
} from "../modelPaths";

export function sortTreeChildren(nodes: ModelNode[]): ModelNode[] {
  const rank = (name: string): number => {
    if (name === OUTLINE_DOC) return 0;
    if (name === DRAFT_DOC) return 1;
    if (name === INDEX_DOC) return 99;
    return 2;
  };
  return [...nodes].sort((a, b) => {
    const ra = rank(a.name);
    const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function transformTreeForDisplay(nodes: ModelNode[]): ModelNode[] {
  return sortTreeChildren(nodes)
    .filter((node) => !(node.type === "file" && isHiddenModelFile(node.name)))
    .map((node) =>
      node.type === "directory" && node.children
        ? { ...node, children: transformTreeForDisplay(node.children) }
        : node,
    );
}

export function findNode(nodes: ModelNode[], pathValue: string): ModelNode | null {
  for (const node of nodes) {
    if (node.path === pathValue) return node;
    const child = node.children ? findNode(node.children, pathValue) : null;
    if (child) return child;
  }
  return null;
}

/** child_order from a loaded tree node, when the subtree includes INDEX metadata. */
export function childOrderForFolder(tree: ModelNode[], folderPath: string): string[] | undefined {
  if (!folderPath) return undefined;
  const node = findNode(tree, folderPath);
  if (node?.type !== "directory" || node.childOrder === undefined) return undefined;
  return node.childOrder;
}

export type ModelNavigateTarget =
  | { type: "folder"; path: string }
  | { type: "file"; path: string };

export type NavigateTarget =
  | ModelNavigateTarget
  | { type: "bib"; citeKey: string };

export function resolveModelPathTarget(
  tree: ModelNode[],
  pathValue: string,
): ModelNavigateTarget | null {
  if (!pathValue) return { type: "folder", path: "" };

  const direct = findNode(tree, pathValue);
  if (direct?.type === "file") {
    return { type: "file", path: pathValue };
  }
  if (direct?.type === "directory") {
    return { type: "folder", path: pathValue };
  }

  const mdCandidate = pathValue.endsWith(".md") ? pathValue : `${pathValue}.md`;
  const fileNode = findNode(tree, mdCandidate);
  if (fileNode?.type === "file") {
    return { type: "file", path: mdCandidate };
  }

  const base = pathValue.split("/").pop() ?? "";
  const parent = parentPath(pathValue);
  const parentNode = findNode(tree, parent);
  const sibling = parentNode?.children?.find(
    (c) => c.type === "file" && c.name.replace(/\.md$/i, "") === base,
  );
  if (sibling) {
    return { type: "file", path: sibling.path };
  }

  return null;
}

export function flattenFiles(nodes: ModelNode[]): ModelNode[] {
  return nodes.flatMap((node) => (node.type === "file" ? [node] : flattenFiles(node.children ?? [])));
}

export function displayFileLabel(fileName: string): string | null {
  if (fileName === INDEX_DOC) return null;
  if (fileName === OUTLINE_DOC) return "Outline";
  if (fileName === DRAFT_DOC) return "Draft";
  return fileName;
}
