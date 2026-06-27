import { getModelTreeVersion } from "./modelEvents.js";
import { readModelTree, type ModelNode, type ReadModelTreeOptions } from "./modelTree.js";

type CacheEntry = {
  treeVersion: number;
  tree: ModelNode[];
};

const cache = new Map<string, CacheEntry>();

function cacheKey(rootPath: string, maxDepth: number | undefined): string {
  return `${rootPath || "__root__"}|${maxDepth ?? "all"}`;
}

function cacheRootFromKey(key: string): string {
  const root = key.split("|")[0] ?? "__root__";
  return root === "__root__" ? "" : root;
}

/** Cached model tree walk; invalidated when structure changes bump treeVersion. */
export async function getCachedModelTree(
  modelRoot: string,
  options: ReadModelTreeOptions = {},
): Promise<ModelNode[]> {
  const rootPath = (options.rootPath ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  const key = cacheKey(rootPath, options.maxDepth);
  const version = getModelTreeVersion();
  const hit = cache.get(key);
  if (hit && hit.treeVersion === version) return hit.tree;

  const tree = await readModelTree(modelRoot, options);
  cache.set(key, { treeVersion: version, tree });
  return tree;
}

export function invalidateModelTreeCache(): void {
  cache.clear();
}

/** Drop cached subtrees likely affected by a model path change. */
export function invalidateModelTreeCacheForChange(path: string | null): void {
  if (!path) {
    cache.clear();
    return;
  }
  const normalized = path.replace(/\\/g, "/");
  for (const key of [...cache.keys()]) {
    const root = cacheRootFromKey(key);
    if (!root || normalized.startsWith(root) || root.startsWith(normalized)) {
      cache.delete(key);
    }
  }
}

export function modelTreeCacheSize(): number {
  return cache.size;
}
