import { describe, expect, it } from "vitest";

import { filterLocalGraph, resolveFocusId, type GraphEdge, type GraphNode } from "./graphLocal";

const nodes: GraphNode[] = [
  { id: "papers/a", label: "Paper A", type: "paper", links: 2 },
  { id: "papers/a/intro", label: "Intro", type: "section", links: 2 },
  { id: "papers/a/intro/claim", label: "Claim", type: "unit", links: 1 },
  { id: "papers/a/results", label: "Results", type: "section", links: 1 },
  { id: "papers/b", label: "Paper B", type: "paper", links: 0 },
];

const edges: GraphEdge[] = [
  { source: "papers/a", target: "papers/a/intro" },
  { source: "papers/a/intro", target: "papers/a/intro/claim" },
  { source: "papers/a/intro", target: "papers/a/results" },
];

describe("resolveFocusId", () => {
  it("walks up to nearest graph node", () => {
    expect(resolveFocusId(nodes, "papers/a/intro/claim")).toBe("papers/a/intro/claim");
    expect(resolveFocusId(nodes, "papers/a/intro/claim/draft.md")).toBe("papers/a/intro/claim");
  });
});

describe("filterLocalGraph", () => {
  it("returns full graph in global mode", () => {
    const result = filterLocalGraph(nodes, edges, "papers/a/intro/claim", 2, "global");
    expect(result.nodes.length).toBe(5);
  });

  it("keeps focus and neighbors within depth", () => {
    const result = filterLocalGraph(nodes, edges, "papers/a/intro/claim", 1, "local");
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["papers/a/intro", "papers/a/intro/claim"].sort());

    const wide = filterLocalGraph(nodes, edges, "papers/a/intro/claim", 2, "local");
    expect(wide.nodes.map((n) => n.id).sort()).toEqual(
      ["papers/a", "papers/a/intro", "papers/a/intro/claim", "papers/a/results"].sort(),
    );
  });

  it("seeds from papers at model root", () => {
    const result = filterLocalGraph(nodes, edges, null, 1, "local");
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain("papers/a");
    expect(ids).toContain("papers/a/intro");
    expect(ids).not.toContain("papers/a/intro/claim");
  });
});
