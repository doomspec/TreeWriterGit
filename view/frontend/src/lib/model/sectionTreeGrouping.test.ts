import { describe, expect, it } from "vitest";

import { groupSectionTreeRows } from "@/lib/model/sectionTreeGrouping";
import type { ModelNode } from "@/lib/model/modelTreeTypes";
import type { PaperSectionItem } from "@/lib/model/modelTree";

function dir(path: string, kind: string, children: ModelNode[] = []): ModelNode {
  return { name: path.split("/").pop() ?? path, path, type: "directory", kind, children };
}

function item(path: string): PaperSectionItem {
  return { name: path.split("/").pop() ?? path, path, title: path.split("/").pop() ?? path };
}

describe("groupSectionTreeRows", () => {
  it("emits a childless subsection exactly once (regression: was duplicated)", () => {
    const tree: ModelNode[] = [dir("p/sub", "subsection", [])];
    const rows = groupSectionTreeRows([item("p/sub")], tree);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ type: "item", item: item("p/sub") });
  });

  it("groups unit children that follow a subsection into a single units row", () => {
    const tree: ModelNode[] = [
      dir("p/sub", "subsection"),
      dir("p/sub/u1", "unit"),
      dir("p/sub/u2", "unit"),
    ];
    const items = [item("p/sub"), item("p/sub/u1"), item("p/sub/u2")];
    const rows = groupSectionTreeRows(items, tree);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ type: "item", item: item("p/sub") });
    expect(rows[1]).toMatchObject({ type: "units-under-subsection", subsection: item("p/sub") });
    if (rows[1].type === "units-under-subsection") {
      expect(rows[1].units.map((u) => u.path)).toEqual(["p/sub/u1", "p/sub/u2"]);
    }
  });

  it("emits a plain (non-subsection) section item once", () => {
    const tree: ModelNode[] = [dir("p/intro", "section")];
    const rows = groupSectionTreeRows([item("p/intro")], tree);
    expect(rows).toEqual([{ type: "item", item: item("p/intro") }]);
  });

  it("does not duplicate two consecutive childless subsections", () => {
    const tree: ModelNode[] = [dir("p/a", "subsection"), dir("p/b", "subsection")];
    const rows = groupSectionTreeRows([item("p/a"), item("p/b")], tree);
    expect(rows.map((r) => (r.type === "item" ? r.item.path : "units"))).toEqual(["p/a", "p/b"]);
  });
});
