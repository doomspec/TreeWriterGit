/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SectionTreeRowMeta } from "@/components/paper/SectionTreeRowMeta";
import type { ModelNode } from "@/lib/modelTree";

vi.mock("@/lib/workspace/WorkspaceNavigationContext", () => ({
  useWorkspaceNavigationContext: () => ({
    assignedCountsByFolder: new Map<string, number>(),
  }),
}));

const paperPath = "papers/demo";
const tree: ModelNode[] = [
  {
    name: "papers",
    path: "papers",
    type: "directory",
    kind: "folder",
    children: [
      {
        name: "demo",
        path: paperPath,
        type: "directory",
        kind: "paper",
        children: [
          {
            name: "abstract",
            path: `${paperPath}/abstract`,
            type: "directory",
            kind: "section",
            children: [],
          },
        ],
      },
    ],
  },
];

describe("SectionTreeRowMeta", () => {
  afterEach(() => cleanup());

  it("opens the actions menu and runs rename", () => {
    const onRename = vi.fn();
    render(
      <SectionTreeRowMeta
        createParentPath={`${paperPath}/abstract`}
        paperPath={paperPath}
        tree={tree}
        title="Abstract"
        rowPath={`${paperPath}/abstract`}
        counts={{ approved: 1, drafted: 0, outline: 0, total: 1 }}
        wordCount={120}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Abstract" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("120 words")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledOnce();
  });

  it("keeps the sidebar open flag set while the menu is open", () => {
    render(
      <SectionTreeRowMeta
        createParentPath={`${paperPath}/abstract`}
        paperPath={paperPath}
        tree={tree}
        title="Abstract"
        rowPath={`${paperPath}/abstract`}
        onCreate={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(document.body.hasAttribute("data-sidebar-floating-menu-open")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Abstract" }));
    expect(document.body.hasAttribute("data-sidebar-floating-menu-open")).toBe(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(document.body.hasAttribute("data-sidebar-floating-menu-open")).toBe(false);
  });
});
