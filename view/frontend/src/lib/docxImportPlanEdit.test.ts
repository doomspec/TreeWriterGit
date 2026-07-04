import { describe, expect, it } from "vitest";

import {
  addImportPlanContainer,
  countImportPlan,
  deleteImportPlanNode,
  mergeImportPlanUnits,
  moveImportPlanNode,
  reorderImportPlanNode,
} from "./docxImportPlanEdit";
import type { DocxImportPreviewNode } from "@treewriter/shared";

const sample: DocxImportPreviewNode[] = [
  {
    title: "Intro",
    slug: "intro",
    kind: "section",
    children: [
      { title: "Unit A", slug: "unit-a", kind: "unit", body: "Alpha text." },
      { title: "Unit B", slug: "unit-b", kind: "unit", body: "Beta text." },
    ],
  },
];

const twoSections: DocxImportPreviewNode[] = [
  {
    title: "Intro",
    slug: "intro",
    kind: "section",
    children: [{ title: "Unit A", slug: "unit-a", kind: "unit", body: "Alpha text." }],
  },
  {
    title: "Methods",
    slug: "methods",
    kind: "section",
    children: [{ title: "Unit B", slug: "unit-b", kind: "unit", body: "Beta text." }],
  },
];

describe("docxImportPlanEdit", () => {
  it("counts sections and units", () => {
    expect(countImportPlan(sample)).toEqual({ sectionsCreated: 1, unitsCreated: 2 });
  });

  it("reorders siblings", () => {
    const next = reorderImportPlanNode(sample, [0], 0, 1);
    expect(next[0]?.children?.map((node) => node.title)).toEqual(["Unit B", "Unit A"]);
  });

  it("deletes a node by path", () => {
    const next = deleteImportPlanNode(sample, [0, 0]);
    expect(next[0]?.children).toHaveLength(1);
    expect(next[0]?.children?.[0]?.title).toBe("Unit B");
  });

  it("merges adjacent units", () => {
    const next = mergeImportPlanUnits(sample, [0, 0]);
    expect(next[0]?.children).toHaveLength(1);
    expect(next[0]?.children?.[0]?.body).toContain("Alpha text.");
    expect(next[0]?.children?.[0]?.body).toContain("Beta text.");
  });

  it("adds a container at the root", () => {
    const next = addImportPlanContainer(sample, null, "section", "Methods");
    expect(next).toHaveLength(2);
    expect(next[1]?.title).toBe("Methods");
  });

  it("moves a unit between sections", () => {
    const next = moveImportPlanNode(twoSections, [0, 0], [1]);
    expect(next[0]?.children ?? []).toHaveLength(0);
    expect(next[1]?.children ?? []).toHaveLength(2);
    expect(next[1]?.children?.[1]?.title).toBe("Unit A");
  });

  it("moves a subsection between sections", () => {
    const nested: DocxImportPreviewNode[] = [
      {
        title: "One",
        slug: "one",
        kind: "section",
        children: [
          { title: "Sub A", slug: "sub-a", kind: "subsection", children: [] },
        ],
      },
      {
        title: "Two",
        slug: "two",
        kind: "section",
        children: [],
      },
    ];
    const next = moveImportPlanNode(nested, [0, 0], [1]);
    expect(next[0]?.children ?? []).toHaveLength(0);
    expect(next[1]?.children ?? []).toHaveLength(1);
    expect(next[1]?.children?.[0]?.title).toBe("Sub A");
  });
});
