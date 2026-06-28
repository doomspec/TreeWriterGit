import { describe, expect, it } from "vitest";

import {
  ensurePathLoaded,
  hasTreeAnchor,
  nodeNeedsSubtreeLoad,
  replaceSubtree,
  subtreeRootForChange,
} from "@/lib/modelTreeMerge";
import type { ModelNode } from "@/lib/modelTreeTypes";

const sampleTree: ModelNode[] = [
  {
    name: "papers",
    path: "papers",
    type: "directory",
    hasChildren: true,
  },
];

describe("subtreeRootForChange", () => {
  it("maps file paths to parent folders", () => {
    expect(subtreeRootForChange("papers/demo/intro/INDEX.md")).toBe("papers/demo/intro");
  });

  it("keeps directory paths as-is", () => {
    expect(subtreeRootForChange("papers/demo/intro")).toBe("papers/demo/intro");
  });
});

describe("replaceSubtree", () => {
  it("merges scoped children under an existing folder", () => {
    const tree: ModelNode[] = [
      {
        name: "papers",
        path: "papers",
        type: "directory",
        children: [
          {
            name: "demo",
            path: "papers/demo",
            type: "directory",
            hasChildren: true,
          },
        ],
      },
    ];
    const merged = replaceSubtree(tree, "papers/demo", [
      {
        name: "intro",
        path: "papers/demo/intro",
        type: "directory",
        children: [],
      },
    ]);
    const demo = merged[0]?.children?.[0];
    expect(demo?.children?.[0]?.name).toBe("intro");
    expect(demo?.hasChildren).toBeUndefined();
  });
});

describe("ensurePathLoaded", () => {
  it("returns stub folders that must be fetched first", () => {
    expect(ensurePathLoaded(sampleTree, "papers/demo")).toEqual(["papers"]);
  });
});

describe("hasTreeAnchor", () => {
  it("accepts stub nodes as anchors", () => {
    expect(hasTreeAnchor(sampleTree, "papers")).toBe(true);
    expect(hasTreeAnchor(sampleTree, "papers/demo")).toBe(false);
  });
});

describe("nodeNeedsSubtreeLoad", () => {
  it("detects unloaded directory stubs", () => {
    expect(nodeNeedsSubtreeLoad(sampleTree[0]!)).toBe(true);
  });
});
