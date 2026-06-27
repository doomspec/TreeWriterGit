import { describe, expect, it } from "vitest";

import {
  isManuscriptDocPath,
  isManuscriptFileForContainer,
  manuscriptContainerPathFromFile,
} from "@/lib/modelPaths";

describe("manuscriptContainerPathFromFile", () => {
  it("returns container path for outline and draft files", () => {
    expect(manuscriptContainerPathFromFile("papers/demo/intro/outline.md")).toBe("papers/demo/intro");
    expect(manuscriptContainerPathFromFile("papers/demo/intro/draft.md")).toBe("papers/demo/intro");
  });

  it("returns null for other files", () => {
    expect(manuscriptContainerPathFromFile("papers/demo/intro/temp-notes.md")).toBeNull();
    expect(manuscriptContainerPathFromFile(null)).toBeNull();
  });

  it("matches container membership", () => {
    expect(isManuscriptFileForContainer("papers/demo/intro/outline.md", "papers/demo/intro")).toBe(true);
    expect(isManuscriptFileForContainer("papers/demo/intro/draft.md", "papers/demo")).toBe(false);
  });

  it("detects manuscript doc paths", () => {
    expect(isManuscriptDocPath("sections/foo/outline.md")).toBe(true);
    expect(isManuscriptDocPath("sections/foo/temp-notes.md")).toBe(false);
  });
});
