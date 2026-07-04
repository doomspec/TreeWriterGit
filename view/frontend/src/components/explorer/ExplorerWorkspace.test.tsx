/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/explorer/ExplorerFileTree", () => ({
  ExplorerFileTree: () => <div data-testid="tree" />,
}));
vi.mock("@/components/explorer/ExplorerTabs", () => ({
  ExplorerTabs: () => <div data-testid="tabs" />,
}));
vi.mock("@/components/explorer/ExplorerFileViewer", () => ({
  ExplorerFileViewer: () => <div data-testid="viewer" />,
}));

const setAppView = vi.fn();
const setExplorerMode = vi.fn();
const closeExplorerTab = vi.fn();
const setSidebarPanel = vi.fn();
const setSidebarPanelOpen = vi.fn();
const toggleSidebarPanel = vi.fn();
const cycleSidebarPanelLayout = vi.fn();
const openFile = vi.fn();
const navState = { sidebarPanelOpen: true, sidebarPinned: false };
const workspaceState: { explorerActiveTab: string | null } = { explorerActiveTab: null };
vi.mock("@/lib/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    get explorerActiveTab() {
      return workspaceState.explorerActiveTab;
    },
    explorerOpenTabs: [],
    openExplorerTab: vi.fn(),
    setError: vi.fn(),
    applyExplorerPathChange: vi.fn(),
    setExplorerActiveTab: vi.fn(),
    closeExplorerTab,
    closeAllExplorerTabs: vi.fn(),
    appView: "workspace",
    setAppView,
    setExplorerMode,
  }),
}));

vi.mock("@/lib/workspace/WorkspaceNavigationContext", () => ({
  useWorkspaceNavigationContext: () => ({
    get sidebarPanelOpen() {
      return navState.sidebarPanelOpen;
    },
    get sidebarPinned() {
      return navState.sidebarPinned;
    },
    setSidebarPanel,
    setSidebarPanelOpen,
    toggleSidebarPanel,
    cycleSidebarPanelLayout,
    openFile,
  }),
}));

const cyclePreference = vi.fn();
vi.mock("@/lib/useTheme", () => ({
  useTheme: () => ({ preference: "light", resolved: "light", setPreference: vi.fn(), cyclePreference }),
}));

import { ExplorerWorkspace } from "@/components/explorer/ExplorerWorkspace";

function explorerProps(overrides: Partial<React.ComponentProps<typeof ExplorerWorkspace>> = {}) {
  return {
    gitSync: null,
    gitStatusLabel: "ok",
    connectionState: "connected",
    onGitClick: vi.fn(),
    pinned: false,
    sidebarWidth: 240,
    onWidthChange: vi.fn(),
    ...overrides,
  };
}

describe("ExplorerWorkspace", () => {
  afterEach(() => {
    cleanup();
    workspaceState.explorerActiveTab = null;
    navState.sidebarPanelOpen = true;
    navState.sidebarPinned = false;
    closeExplorerTab.mockClear();
    setSidebarPanel.mockClear();
    toggleSidebarPanel.mockClear();
    cycleSidebarPanelLayout.mockClear();
    openFile.mockClear();
  });

  it("renders a sidebar rail with theme and settings icons", () => {
    render(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.getByRole("button", { name: "Pin sidebar panel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Theme:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /AI assistant/i })).not.toBeTruthy();
  });

  it("shows Write/Explorer toggle at the top and git status at the bottom", () => {
    render(<ExplorerWorkspace {...explorerProps({ pinned: true })} />);
    expect(screen.getByRole("button", { name: "Explorer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Write" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /git ok/i })).toBeTruthy();
    expect(screen.getByText(/terminal connected/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unpin sidebar panel" })).not.toBeTruthy();
  });

  it("cycles sidebar layout from the rail button", () => {
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pin sidebar panel" }));
    expect(cycleSidebarPanelLayout).toHaveBeenCalledTimes(1);
  });

  it("hides the file tree when sidebarPanelOpen is false", () => {
    navState.sidebarPanelOpen = false;
    render(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.queryByTestId("tree")).not.toBeTruthy();
    expect(screen.queryByText(/terminal connected/i)).not.toBeTruthy();
  });

  it("shows a resize handle when the file tree is open and pinned", () => {
    render(<ExplorerWorkspace {...explorerProps({ pinned: true })} />);
    expect(screen.getByRole("separator", { name: "Resize sidebar" })).toBeTruthy();
  });

  it("clicking the theme icon cycles the theme preference", () => {
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /Theme:/ }));
    expect(cyclePreference).toHaveBeenCalledTimes(1);
  });

  it("clicking Settings navigates to the settings app view", () => {
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(setAppView).toHaveBeenCalledWith("settings");
  });

  it("clicking the Writer-mode launcher switches back to Writer mode", () => {
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(setExplorerMode).toHaveBeenCalledWith(false);
  });

  it("shows no papers/ warning when no file, or a non-papers file, is open", () => {
    workspaceState.explorerActiveTab = null;
    const { rerender } = render(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.queryByRole("status")).not.toBeTruthy();

    workspaceState.explorerActiveTab = "quick-start/README.md";
    rerender(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.queryByRole("status")).not.toBeTruthy();
  });

  it("shows a confirm dialog before the papers/ banner on first open", () => {
    workspaceState.explorerActiveTab = "papers/vibecount/outline.md";
    render(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Edit paper files in Explorer/i)).toBeTruthy();
    expect(screen.queryByRole("status")).not.toBeTruthy();
  });

  it("shows the banner after Proceed anyway and skips the dialog on a second papers/ tab", () => {
    workspaceState.explorerActiveTab = "papers/vibecount/outline.md";
    const { rerender } = render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Proceed anyway" }));
    expect(screen.getByRole("status").textContent).toMatch(/experienced users only/i);

    workspaceState.explorerActiveTab = "papers/vibecount/draft.md";
    rerender(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.queryByRole("dialog")).not.toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/experienced users only/i);
  });

  it("closes the tab when the papers confirm dialog is cancelled", () => {
    workspaceState.explorerActiveTab = "papers/vibecount/outline.md";
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(closeExplorerTab).toHaveBeenCalledWith("papers/vibecount/outline.md");
  });

  it("shows main.bib manual-edit dialog when opening main.bib", () => {
    workspaceState.explorerActiveTab = "main.bib";
    render(<ExplorerWorkspace {...explorerProps()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Edit main.bib manually/i)).toBeTruthy();
  });

  it("opens reference manager from main.bib dialog without enabling manual mode", () => {
    workspaceState.explorerActiveTab = "main.bib";
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open reference manager" }));
    expect(closeExplorerTab).toHaveBeenCalledWith("main.bib");
    expect(setExplorerMode).toHaveBeenCalledWith(false);
    expect(setSidebarPanel).toHaveBeenCalledWith("references");
    expect(setSidebarPanelOpen).toHaveBeenCalledWith(true);
    expect(openFile).toHaveBeenCalledWith("main.bib");
  });

  it("allows manual main.bib editing after Proceed", () => {
    workspaceState.explorerActiveTab = "main.bib";
    render(<ExplorerWorkspace {...explorerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit manually anyway" }));
    expect(screen.getByTestId("viewer")).toBeTruthy();
    expect(screen.queryByRole("dialog")).not.toBeTruthy();
  });
});
