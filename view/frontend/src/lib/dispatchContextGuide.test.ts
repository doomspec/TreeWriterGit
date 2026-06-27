import { describe, expect, it } from "vitest";

import {
  buildContextCliExamples,
  buildContextCliQuickRef,
  paperRootFromPath,
} from "./dispatchContextGuide";

describe("dispatchContextGuide", () => {
  it("extracts paper root from unit paths", () => {
    expect(paperRootFromPath("papers/vibecount/intro/problem")).toBe("papers/vibecount");
    expect(paperRootFromPath("notes/lit.md")).toBe("");
  });

  it("scopes CLI examples to current unit", () => {
    const lines = buildContextCliExamples("papers/demo/intro/unit");
    expect(lines[0]).toContain("--root papers/demo");
    expect(lines[1]).toContain("papers/demo/intro/unit/draft.md");
  });

  it("quick ref mentions context skill and import", () => {
    const ref = buildContextCliQuickRef("papers/demo/x");
    expect(ref).toContain("treewriter-context-cli.md");
    expect(ref).toContain("import-docx");
  });
});
