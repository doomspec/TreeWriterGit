import { describe, expect, it, vi } from "vitest";

import { navigateFromTarget } from "@/lib/useWorkspaceNavigation";

describe("navigateFromTarget", () => {
  it("opens bib files with cite key", () => {
    const openFile = vi.fn();
    const navigateTo = vi.fn();

    navigateFromTarget({ type: "bib", citeKey: "smith2020" }, { openFile, navigateTo });

    expect(openFile).toHaveBeenCalledWith("main.bib", { citeKey: "smith2020" });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("resolves folder paths through the model tree when provided", () => {
    const openFile = vi.fn();
    const navigateTo = vi.fn();
    const tree = [
      {
        name: "foo",
        path: "papers/foo",
        type: "directory" as const,
        children: [],
      },
    ];

    navigateFromTarget({ type: "folder", path: "papers/foo" }, { openFile, navigateTo, tree });

    expect(navigateTo).toHaveBeenCalledWith("papers/foo");
  });
});
