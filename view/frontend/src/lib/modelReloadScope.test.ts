import { describe, expect, it } from "vitest";

import { resolveModelReloadScope } from "@/lib/modelReloadScope";

describe("resolveModelReloadScope", () => {
  it("prefers the active file folder over browse and paper paths", () => {
    expect(
      resolveModelReloadScope({
        activeFile: "papers/demo/sections/intro/unit-a/draft.md",
        browsePath: "papers/demo/sections/intro",
        paperPath: "papers/demo",
      }),
    ).toEqual({ path: "papers/demo/sections/intro/unit-a" });
  });

  it("uses browsePath when no active file is set", () => {
    expect(
      resolveModelReloadScope({
        browsePath: "papers/demo/sections/intro",
        paperPath: "papers/demo",
      }),
    ).toEqual({ path: "papers/demo/sections/intro" });
  });

  it("skips papers root and falls back to paperPath", () => {
    expect(
      resolveModelReloadScope({
        browsePath: "papers",
        paperPath: "papers/demo",
      }),
    ).toEqual({ path: "papers/demo" });
  });
});
