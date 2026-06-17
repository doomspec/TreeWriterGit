export type GraphNodeType = "paper" | "section" | "unit" | "figure" | "note" | "missing" | "doc";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  links: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind?: "outline" | "contains";
}

export type GraphScope = "local" | "global";

/** API scope for graph data — paper-level (not leaf unit) so parent contains edges exist. */
export function resolveGraphFetchRoot(navPath: string): string {
  if (!navPath) return "";
  const paper = navPath.match(/^papers\/([^/]+)/);
  if (paper) return `papers/${paper[1]}`;
  return "";
}

/** All path prefixes for ancestor chain (e.g. a/b/c → [a, a/b, a/b/c]). */
export function pathPrefixIds(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i <= parts.length; i += 1) {
    out.push(parts.slice(0, i).join("/"));
  }
  return out;
}

/** Map current navigation path to a graph node id (walks up to nearest folder node). */
export function resolveFocusId(nodes: GraphNode[], path: string): string | null {
  if (!path) return null;
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.has(path)) return path;

  const parts = path.split("/").filter(Boolean);
  while (parts.length > 0) {
    const candidate = parts.join("/");
    if (ids.has(candidate)) return candidate;
    parts.pop();
  }
  return null;
}

function buildAdjacency(edges: GraphEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const { source, target } of edges) {
    link(source, target);
    link(target, source);
  }
  return adj;
}

function bfsReachable(start: string, adj: Map<string, Set<string>>, maxDepth: number): Set<string> {
  const seen = new Set<string>([start]);
  const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const neighbor of adj.get(id) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }
  }
  return seen;
}

function seedFocusId(nodes: GraphNode[]): string | null {
  const paper = nodes.find((n) => n.type === "paper");
  if (paper) return paper.id;
  return nodes[0]?.id ?? null;
}

export function filterLocalGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusId: string | null,
  depth: number,
  scope: GraphScope,
): { nodes: GraphNode[]; edges: GraphEdge[]; focusId: string | null } {
  if (scope === "global" || nodes.length === 0) {
    return { nodes, edges, focusId };
  }

  const adj = buildAdjacency(edges);
  const resolvedFocus = focusId ?? seedFocusId(nodes);
  if (!resolvedFocus) {
    return { nodes: [], edges: [], focusId: null };
  }

  const keep = bfsReachable(resolvedFocus, adj, Math.max(1, depth));
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  for (const prefix of pathPrefixIds(resolvedFocus)) {
    if (nodeIdSet.has(prefix)) keep.add(prefix);
  }
  const filteredNodes = nodes.filter((n) => keep.has(n.id));
  const filteredEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));

  return { nodes: filteredNodes, edges: filteredEdges, focusId: resolvedFocus };
}

/** Show node title only while the pointer is over that node. */
export function shouldShowLabel(nodeId: string, hovered: string | null): boolean {
  return hovered === nodeId;
}
