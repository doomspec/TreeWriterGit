/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useWorkspaceNavigation } from "@/lib/useWorkspaceNavigation";
import type { ModelNode } from "@/lib/modelTree";

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
        children: [
          {
            name: "structure",
            path: "papers/demo/structure",
            type: "directory",
            children: [
              { name: "INDEX.md", path: "papers/demo/structure/INDEX.md", type: "file" },
              { name: "outline.md", path: "papers/demo/structure/outline.md", type: "file" },
              {
                name: "unit-a",
                path: "papers/demo/structure/unit-a",
                type: "directory",
                children: [
                  { name: "outline.md", path: "papers/demo/structure/unit-a/outline.md", type: "file" },
                  { name: "draft.md", path: "papers/demo/structure/unit-a/draft.md", type: "file" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("useWorkspaceNavigation", () => {
  it("restores browse path when backing out of a unit opened from a section", () => {
    let currentPath = "papers/demo/structure";
    let activeFile: string | null = null;

    const { result } = renderHook(() =>
      useWorkspaceNavigation({
        tree,
        lastPaperPath: "papers/demo",
        setCurrentPath: (next) => {
          currentPath = typeof next === "function" ? next(currentPath) : next;
        },
        setActiveFile: (next) => {
          activeFile = typeof next === "function" ? next(activeFile) : next;
        },
        setEditorLayout: vi.fn(),
        setSearchQuery: vi.fn(),
        setSelectedBibCiteKey: vi.fn(),
      }),
    );

    act(() => {
      result.current.openFile("papers/demo/structure/unit-a/outline.md");
    });
    expect(currentPath).toBe("papers/demo/structure/unit-a");
    expect(activeFile).toBe("papers/demo/structure/unit-a/outline.md");

    act(() => {
      result.current.backToSectionView();
    });
    expect(currentPath).toBe("papers/demo/structure");
    expect(activeFile).toBeNull();
  });

  it("clears return path when navigating away via navigateTo", () => {
    let currentPath = "papers/demo/structure";
    let activeFile: string | null = null;

    const { result } = renderHook(() =>
      useWorkspaceNavigation({
        tree,
        lastPaperPath: "papers/demo",
        setCurrentPath: (next) => {
          currentPath = typeof next === "function" ? next(currentPath) : next;
        },
        setActiveFile: (next) => {
          activeFile = typeof next === "function" ? next(activeFile) : next;
        },
        setEditorLayout: vi.fn(),
        setSearchQuery: vi.fn(),
        setSelectedBibCiteKey: vi.fn(),
      }),
    );

    act(() => {
      result.current.openFile("papers/demo/structure/unit-a/outline.md");
    });

    act(() => {
      result.current.navigateTo("papers/demo");
    });
    expect(currentPath).toBe("papers/demo");

    act(() => {
      result.current.backToSectionView();
    });

    expect(currentPath).toBe("papers/demo");
    expect(activeFile).toBeNull();
  });
});
