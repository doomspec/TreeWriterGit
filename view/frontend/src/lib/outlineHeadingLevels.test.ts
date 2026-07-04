import { describe, expect, it } from "vitest";

import { extractMarkdownHeadings } from "@/lib/markdownOutline";
import { applyOutlineHeadingLevelsFromModel } from "@/lib/outlineHeadingLevels";
import type { ModelNode } from "@/lib/modelTreeTypes";
import { groupSectionTreeRows } from "@/lib/sectionTreeGrouping";

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
        kind: "paper",
        children: [
          {
            name: "methods",
            path: "papers/demo/methods",
            type: "directory",
            kind: "section",
            children: [
              {
                name: "platforms",
                path: "papers/demo/methods/platforms",
                type: "directory",
                kind: "subsection",
              },
              {
                name: "intro",
                path: "papers/demo/methods/intro",
                type: "directory",
                kind: "unit",
              },
              {
                name: "details",
                path: "papers/demo/methods/details",
                type: "directory",
                kind: "unit",
              },
              {
                name: "orphan-unit",
                path: "papers/demo/methods/orphan-unit",
                type: "directory",
                kind: "unit",
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("applyOutlineHeadingLevelsFromModel", () => {
  it("nests subsection and unit levels using model paths", () => {
    const markdown = `# Methods

## [Platforms](platforms/INDEX.md)

## [Intro](intro/INDEX.md)

## [Orphan](orphan-unit/INDEX.md)`;

    const headings = applyOutlineHeadingLevelsFromModel(
      extractMarkdownHeadings(markdown),
      tree,
      "papers/demo/methods",
    );

    expect(headings.map((heading) => [heading.text, heading.level])).toEqual([
      ["Methods", 1],
      ["Platforms", 2],
      ["Intro", 2],
      ["Orphan", 2],
    ]);
  });

  it("deepens levels for units nested under a subsection folder", () => {
    const nestedTree: ModelNode[] = [
      {
        name: "papers",
        path: "papers",
        type: "directory",
        children: [
          {
            name: "demo",
            path: "papers/demo",
            type: "directory",
            kind: "paper",
            children: [
              {
                name: "methods",
                path: "papers/demo/methods",
                type: "directory",
                kind: "section",
                children: [
                  {
                    name: "platforms",
                    path: "papers/demo/methods/platforms",
                    type: "directory",
                    kind: "subsection",
                    children: [
                      {
                        name: "intro",
                        path: "papers/demo/methods/platforms/intro",
                        type: "directory",
                        kind: "unit",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const markdown = `# Methods

## [Platforms](platforms/INDEX.md)

## [Intro](platforms/intro/INDEX.md)`;

    const headings = applyOutlineHeadingLevelsFromModel(
      extractMarkdownHeadings(markdown),
      nestedTree,
      "papers/demo/methods",
    );

    expect(headings.map((heading) => [heading.text, heading.level])).toEqual([
      ["Methods", 1],
      ["Platforms", 2],
      ["Intro", 3],
    ]);
  });
});

describe("groupSectionTreeRows", () => {
  it("groups consecutive unit siblings under a preceding subsection", () => {
    const items = [
      {
        name: "platforms",
        path: "papers/demo/methods/platforms",
        title: "Platforms",
      },
      {
        name: "intro",
        path: "papers/demo/methods/intro",
        title: "Intro",
      },
      {
        name: "details",
        path: "papers/demo/methods/details",
        title: "Details",
      },
    ];

    const rows = groupSectionTreeRows(items, tree);
    expect(rows).toEqual([
      { type: "item", item: items[0] },
      {
        type: "units-under-subsection",
        subsection: items[0],
        units: [items[1], items[2]],
      },
    ]);
  });
});
