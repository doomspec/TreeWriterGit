/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BibMainBibWorkspace } from "@/components/editor/EditorWorkspace";

vi.mock("@/components/editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor">source</div>,
}));

vi.mock("@/components/editor/BibFilePreview", () => ({
  BibFilePreview: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="bib-preview">{headerActions}</div>
  ),
}));

vi.mock("@/lib/bibLibraryContext", () => ({
  useBibLibrarySummary: () => ({ summary: { total: 3 } }),
}));

vi.mock("@/lib/useWindowWidth", () => ({
  useWindowWidth: () => 1400,
}));

const setSidebarPanel = vi.fn();
const setSidebarPanelOpen = vi.fn();
const openFile = vi.fn();

vi.mock("@/lib/workspace/WorkspaceNavigationContext", () => ({
  useWorkspaceNavigationContext: () => ({
    sidebarPanel: "papers",
    sidebarPanelOpen: true,
    selectedBibCiteKey: null,
    setSidebarPanel,
    setSidebarPanelOpen,
    openFile,
  }),
}));

vi.mock("@/lib/workspacePreferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspacePreferences")>();
  return {
    ...actual,
    loadWorkspacePreferences: () => ({}),
    mergeWorkspaceDefaults: (partial: object) =>
      actual.mergeWorkspaceDefaults({ ...partial, loadLargeBibSource: false }),
    scheduleSaveWorkspacePreferences: vi.fn(),
  };
});

function baseProps(overrides: Partial<React.ComponentProps<typeof BibMainBibWorkspace>> = {}) {
  return {
    activeFile: "main.bib",
    refreshVersion: 0,
    getPathVersion: () => 0,
    layout: "split" as const,
    onLayoutChange: vi.fn(),
    dualPaneSplit: 50,
    onDualPaneSplitChange: vi.fn(),
    onError: vi.fn(),
    linkContextPath: "main.bib",
    ...overrides,
  };
}

describe("BibMainBibWorkspace manual-edit gate", () => {
  afterEach(() => {
    cleanup();
    setSidebarPanel.mockClear();
    setSidebarPanelOpen.mockClear();
    openFile.mockClear();
  });

  it("shows a dialog when Load full main.bib is clicked", () => {
    render(<BibMainBibWorkspace {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Load full main.bib" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Edit main.bib manually/i)).toBeTruthy();
    expect(screen.queryByTestId("markdown-editor")).not.toBeTruthy();
  });

  it("routes Open reference manager without enabling full source", () => {
    const onLayoutChange = vi.fn();
    render(<BibMainBibWorkspace {...baseProps({ onLayoutChange })} />);
    fireEvent.click(screen.getByRole("button", { name: "Load full main.bib" }));
    fireEvent.click(screen.getByRole("button", { name: "Open reference manager" }));
    expect(onLayoutChange).not.toHaveBeenCalledWith("source");
    expect(setSidebarPanel).toHaveBeenCalledWith("references");
    expect(setSidebarPanelOpen).toHaveBeenCalledWith(true);
    expect(openFile).toHaveBeenCalledWith("main.bib", undefined);
    expect(screen.queryByTestId("markdown-editor")).not.toBeTruthy();
  });

  it("enables full source after Edit manually anyway", () => {
    render(<BibMainBibWorkspace {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Load full main.bib" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit manually anyway" }));
    expect(screen.getByTestId("markdown-editor")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows a dialog when switching to Source layout", () => {
    render(<BibMainBibWorkspace {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
