import { describe, expect, it } from "vitest";

import {
  childCardsForFolder,
  displayFileLabel,
  isIndexStale,
  isUnitFolder,
  outlineLinkTargets,
  parseFrontmatterLinks,
  parseIndexFrontmatter,
  parseIndexOutline,
  resolveOutlineTarget,
  sectionsForPaper,
  sortTreeChildren,
  type ModelNode,
} from "./modelTree";

const ROOT_INDEX = `---
title: Git-Based Automated Model-View System
summary: A Git-native model-view architecture.
composed_at_commit: abc123
---

# Git-Based Automated Model-View System

## Outline

* [Philosophy](Philosophy/INDEX.md)
* [TreeWriter](TreeWriter/INDEX.md)
`;

describe("displayFileLabel", () => {
  it("hides INDEX and labels outline and draft", () => {
    expect(displayFileLabel("INDEX.md")).toBeNull();
    expect(displayFileLabel("outline.md")).toBe("Outline");
    expect(displayFileLabel("draft.md")).toBe("Draft");
    expect(displayFileLabel("notes.md")).toBe("notes.md");
  });
});

describe("parseFrontmatterLinks", () => {
  it("reads plain link paths from frontmatter", () => {
    const md = `---
kind: unit
links:
  - results/foo
  - supplementary/bar
---
# Unit
`;
    expect(parseFrontmatterLinks(md)).toEqual(["results/foo", "supplementary/bar"]);
  });
});

describe("outlineLinkTargets", () => {
  it("merges INDEX links and outline section", () => {
    const indexMd = `---
links:
  - discussion/main
---
`;
    const outlineMd = `# Intro

## Outline

* [Methods](methods/INDEX.md)
`;
    const targets = outlineLinkTargets(indexMd, outlineMd, "papers/a/intro");
    expect(targets).toContain("papers/a/intro/discussion/main");
    expect(targets).toContain("papers/a/intro/methods/INDEX.md");
  });
});

describe("sortTreeChildren", () => {
  it("orders outline before draft", () => {
    const nodes: ModelNode[] = [
      { name: "draft.md", path: "a/draft.md", type: "file" },
      { name: "notes.md", path: "a/notes.md", type: "file" },
      { name: "outline.md", path: "a/outline.md", type: "file" },
      { name: "INDEX.md", path: "a/INDEX.md", type: "file" },
    ];
    expect(sortTreeChildren(nodes).map((n) => n.name)).toEqual([
      "outline.md",
      "draft.md",
      "notes.md",
      "INDEX.md",
    ]);
  });
});

describe("parseIndexFrontmatter", () => {
  it("reads title summary and composed_at_commit", () => {
    const meta = parseIndexFrontmatter(ROOT_INDEX);
    expect(meta.title).toBe("Git-Based Automated Model-View System");
    expect(meta.summary).toContain("Git-native");
    expect(meta.composedAtCommit).toBe("abc123");
  });

  it("reads child_order lists", () => {
    const md = `---
child_order:
  - intro
  - methods
---
# Section
`;
    expect(parseIndexFrontmatter(md).childOrder).toEqual(["intro", "methods"]);
  });
});

describe("parseIndexOutline", () => {
  it("parses markdown outline links", () => {
    const links = parseIndexOutline(ROOT_INDEX, "");
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0].label).toBe("Philosophy");
    expect(links[0].targetPath).toBe("Philosophy/INDEX.md");
  });
});

describe("resolveOutlineTarget", () => {
  it("resolves relative md paths", () => {
    expect(resolveOutlineTarget("papers/a", "intro/draft.md")).toBe("papers/a/intro/draft.md");
  });
});

describe("isIndexStale", () => {
  it("flags missing composed_at_commit", () => {
    expect(isIndexStale(null)).toBe(true);
    expect(isIndexStale("abc")).toBe(false);
  });
});

describe("isUnitFolder", () => {
  it("true when outline.md is present without draft", () => {
    const node: ModelNode = {
      name: "intro",
      path: "papers/a/intro",
      type: "directory",
      children: [{ name: "outline.md", path: "papers/a/intro/outline.md", type: "file" }],
    };
    expect(isUnitFolder(node)).toBe(true);
  });

  it("true when draft.md is present", () => {
    const node: ModelNode = {
      name: "claim",
      path: "papers/a/claim",
      type: "directory",
      children: [{ name: "draft.md", path: "papers/a/claim/draft.md", type: "file" }],
    };
    expect(isUnitFolder(node)).toBe(true);
  });

  it("false for container-only folders", () => {
    const node: ModelNode = {
      name: "sections",
      path: "papers/a/sections",
      type: "directory",
      children: [{ name: "intro", path: "papers/a/sections/intro", type: "directory" }],
    };
    expect(isUnitFolder(node)).toBe(false);
  });
});

describe("childCardsForFolder", () => {
  const tree: ModelNode[] = [
    {
      name: "methods",
      path: "methods",
      type: "directory",
      children: [{ name: "draft.md", path: "methods/draft.md", type: "file" }],
    },
    { name: "intro", path: "intro", type: "directory", children: [] },
  ];

  it("orders children by child_order", () => {
    const cards = childCardsForFolder(tree, "", ["intro", "methods"]);
    expect(cards.map((c) => c.name)).toEqual(["intro", "methods"]);
  });
});

describe("sectionsForPaper", () => {
  const tree: ModelNode[] = [
    {
      name: "roboculture",
      path: "papers/roboculture",
      type: "directory",
      children: [
        { name: "results", path: "papers/roboculture/results", type: "directory" },
        { name: "introduction", path: "papers/roboculture/introduction", type: "directory" },
      ],
    },
  ];

  it("orders sections by section_order", () => {
    const sections = sectionsForPaper(tree, "papers/roboculture", ["introduction", "results"]);
    expect(sections.map((s) => s.name)).toEqual(["introduction", "results"]);
  });
});
