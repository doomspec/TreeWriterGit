import { describe, expect, it } from "vitest";

import { resolveWorkspaceView } from "@/lib/resolveWorkspaceView";

describe("resolveWorkspaceView", () => {
  it("prefers paper workspace over section and activeFile", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: "papers/demo",
        tablePath: null,
        sectionPath: "papers/demo/intro",
        unitPath: null,
        activeFile: "papers/demo/outline.md",
      }),
    ).toEqual({ kind: "paper", path: "papers/demo" });
  });

  it("prefers table over section", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: null,
        tablePath: "papers/demo/tables/table-1",
        sectionPath: "papers/demo/intro",
        unitPath: null,
        activeFile: null,
      }),
    ).toEqual({ kind: "table", path: "papers/demo/tables/table-1" });
  });

  it("prefers section workspace over generic activeFile editor", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: null,
        tablePath: null,
        sectionPath: "papers/demo/intro",
        unitPath: null,
        activeFile: "papers/demo/intro/outline.md",
      }),
    ).toEqual({ kind: "section", path: "papers/demo/intro" });
  });

  it("routes unit folders to editor", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: null,
        tablePath: null,
        sectionPath: null,
        unitPath: "papers/demo/intro/unit-a",
        activeFile: "papers/demo/intro/unit-a/outline.md",
      }),
    ).toEqual({
      kind: "editor",
      unitPath: "papers/demo/intro/unit-a",
      activeFile: "papers/demo/intro/unit-a/outline.md",
    });
  });

  it("routes loose markdown files to editor when no sectionPath", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: null,
        tablePath: null,
        sectionPath: null,
        unitPath: null,
        activeFile: "TreeWriter/application-shape.md",
      }),
    ).toEqual({
      kind: "editor",
      unitPath: null,
      activeFile: "TreeWriter/application-shape.md",
    });
  });

  it("falls back to browse when nothing is selected", () => {
    expect(
      resolveWorkspaceView({
        paperWorkspacePath: null,
        tablePath: null,
        sectionPath: null,
        unitPath: null,
        activeFile: null,
      }),
    ).toEqual({ kind: "browse" });
  });
});
