import { parentPath } from "../modelPaths";
import type { ModelNode } from "./modelTreeTypes";

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Map a model-changed path to the folder subtree that should be refetched. */
export function subtreeRootForChange(changedPath: string | null | undefined): string {
  if (!changedPath) return "";
  const normalized = normalizePath(changedPath);
  if (!normalized) return "";
  const base = normalized.split("/").pop() ?? "";
  if (base.includes(".")) {
    return parentPath(normalized);
  }
  return normalized;
}

function mergeAtPath(
  nodes: ModelNode[],
  segments: string[],
  depth: number,
  replacement: ModelNode[],
): ModelNode[] {
  if (depth >= segments.length) return replacement;

  const segment = segments[depth];
  let found = false;
  const next = nodes.map((node) => {
    if (node.name !== segment || node.type !== "directory") return node;
    found = true;
    if (depth === segments.length - 1) {
      return {
        ...node,
        children: replacement,
        hasChildren: replacement.length > 0 ? undefined : false,
      };
    }
    return {
      ...node,
      children: mergeAtPath(node.children ?? [], segments, depth + 1, replacement),
      hasChildren: undefined,
    };
  });

  return found ? next : nodes;
}

/** Replace children at folderPath with nodes from a scoped tree fetch. */
export function replaceSubtree(
  tree: ModelNode[],
  folderPath: string,
  nodes: ModelNode[],
): ModelNode[] {
  const normalized = normalizePath(folderPath);
  if (!normalized) return nodes;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return nodes;
  return mergeAtPath(tree, segments, 0, nodes);
}

/** Whether folderPath exists as a directory node in the tree. */
export function hasTreeAnchor(tree: ModelNode[], folderPath: string): boolean {
  const normalized = normalizePath(folderPath);
  if (!normalized) return true;
  const segments = normalized.split("/").filter(Boolean);
  let current = tree;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const node = current.find((entry) => entry.name === segment && entry.type === "directory");
    if (!node) return false;
    if (index === segments.length - 1) return true;
    if (!node.children) return false;
    current = node.children;
  }
  return true;
}

/** Folder paths that must be loaded before findNode can resolve targetPath. */
export function ensurePathLoaded(tree: ModelNode[], targetPath: string): string[] {
  const normalized = normalizePath(targetPath);
  if (!normalized) return [];

  const segments = normalized.split("/").filter(Boolean);
  const toLoad: string[] = [];
  let current = tree;
  let acc = "";

  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = current.find((entry) => entry.name === segment);
    if (!node) {
      const loadPath = parentPath(acc);
      if (loadPath || acc.split("/").length === 1) {
        toLoad.push(loadPath);
      }
      break;
    }
    if (node.type === "file") break;
    if (node.hasChildren && node.children === undefined) {
      toLoad.push(node.path);
      break;
    }
    if (!node.children) {
      toLoad.push(node.path);
      break;
    }
    current = node.children;
  }

  return [...new Set(toLoad)];
}

/** Whether a directory node needs a subtree fetch before expanding. */
export function nodeNeedsSubtreeLoad(node: ModelNode): boolean {
  return node.type === "directory" && Boolean(node.hasChildren) && !node.children?.length;
}
