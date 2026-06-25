import path from "node:path";
import { readdir } from "node:fs/promises";

import { ModelFsError, readIndexData, resolveModelPath, toRelative } from "./modelFs.js";

/** Directories omitted from navigation tree walks. */
const SKIP_TREE_DIRS = new Set(["notes", ".sessions", ".trash"]);

export type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  /** From INDEX.md frontmatter when present. */
  kind?: string;
  /** INDEX.md child_order for directories (empty when unset). */
  childOrder?: string[];
  children?: ModelNode[];
  /** Present when children were not loaded (depth-limited subtree). */
  hasChildren?: boolean;
};

export type ReadModelTreeOptions = {
  /** Relative path under model root; empty string = model root. */
  rootPath?: string;
  /** Max directory levels below rootPath. Omit for unlimited recursion. */
  maxDepth?: number;
};

function shouldSkipEntry(name: string, isDirectory: boolean): boolean {
  if (name.startsWith(".")) return true;
  if (isDirectory && SKIP_TREE_DIRS.has(name)) return true;
  return false;
}

function parseChildOrder(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.child_order) && data.child_order.length > 0) {
    return data.child_order.map(String);
  }
  if (Array.isArray(data.section_order)) {
    return data.section_order.map(String);
  }
  return [];
}

function orderNodesByChildOrder(nodes: ModelNode[], childOrder: string[]): ModelNode[] {
  if (childOrder.length === 0) return nodes;
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const ordered: ModelNode[] = [];
  for (const name of childOrder) {
    const node = byName.get(name);
    if (node) ordered.push(node);
  }
  for (const node of nodes) {
    if (!ordered.some((entry) => entry.name === node.name)) {
      ordered.push(node);
    }
  }
  return ordered;
}

async function directoryHasChildren(modelRoot: string, absolutePath: string): Promise<boolean> {
  const entries = await readdir(absolutePath, { withFileTypes: true });
  return entries.some((entry) => !shouldSkipEntry(entry.name, entry.isDirectory()));
}

async function readDirectoryNodes(
  modelRoot: string,
  directoryAbs: string,
  depthRemaining: number | undefined,
): Promise<ModelNode[]> {
  const parentRel = toRelative(modelRoot, directoryAbs);
  const parentIndex = parentRel ? await readIndexData(modelRoot, parentRel) : {};
  const parentChildOrder = parseChildOrder(parentIndex);

  const entries = await readdir(directoryAbs, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((entry) => !shouldSkipEntry(entry.name, entry.isDirectory()))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(async (entry) => {
        const absolutePath = path.join(directoryAbs, entry.name);
        const relativePath = toRelative(modelRoot, absolutePath);

        if (entry.isDirectory()) {
          const indexData = await readIndexData(modelRoot, relativePath);
          const kind = typeof indexData.kind === "string" ? indexData.kind : undefined;
          const childOrder = parseChildOrder(indexData);

          if (depthRemaining === 0) {
            const hasChildren = await directoryHasChildren(modelRoot, absolutePath);
            return {
              name: entry.name,
              path: relativePath,
              type: "directory" as const,
              kind,
              childOrder,
              hasChildren,
            };
          }

          const nextDepth =
            depthRemaining === undefined ? undefined : Math.max(0, depthRemaining - 1);
          const children = await readDirectoryNodes(modelRoot, absolutePath, nextDepth);
          return {
            name: entry.name,
            path: relativePath,
            type: "directory" as const,
            kind,
            childOrder,
            children,
          };
        }

        return {
          name: entry.name,
          path: relativePath,
          type: "file" as const,
        };
      }),
  );

  return orderNodesByChildOrder(nodes, parentChildOrder);
}

/** Walk model directories; optional scoped root and depth limit. */
export async function readModelTree(
  modelRoot: string,
  options: ReadModelTreeOptions = {},
): Promise<ModelNode[]> {
  const rootPath = (options.rootPath ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  const directoryAbs = rootPath ? resolveModelPath(modelRoot, rootPath) : modelRoot;

  try {
    return await readDirectoryNodes(modelRoot, directoryAbs, options.maxDepth);
  } catch (error) {
    if (error instanceof ModelFsError) throw error;
    throw error;
  }
}
