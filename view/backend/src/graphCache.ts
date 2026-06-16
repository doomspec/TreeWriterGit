import type { Graph } from "./graph.js";
import { buildGraph } from "./graph.js";

const cache = new Map<string, Graph>();

function cacheKey(rootRel: string): string {
  return rootRel || "__root__";
}

export async function getCachedGraph(modelRoot: string, rootRel = ""): Promise<Graph> {
  const key = cacheKey(rootRel);
  const hit = cache.get(key);
  if (hit) return hit;
  const graph = await buildGraph(modelRoot, rootRel);
  cache.set(key, graph);
  return graph;
}

export function invalidateGraphCache(): void {
  cache.clear();
}

export function graphCacheSize(): number {
  return cache.size;
}
