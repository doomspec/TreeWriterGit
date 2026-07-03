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
vi.mock("@/lib/workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    explorerActiveTab: null,
    explorerOpenTabs: [],
    openExplorerTab: vi.fn(),
    setError: vi.fn(),
    applyExplorerPathChange: vi.fn(),
    setExplorerActiveTab: vi.fn(),
    closeExplorerTab: vi.fn(),
    appView: "workspace",
    setAppView,
  }),
}));

const cyclePreference = vi.fn();
vi.mock("@/lib/useTheme", () => ({
  useTheme: () => ({ preference: "light", resolved: "light", setPreference: vi.fn(), cyclePreference }),
}));

const setAiPanelOpen = vi.fn();
vi.mock("@/lib/workspace/WorkspaceLayoutContext", () => ({
  useWorkspaceLayout: () => ({ aiPanelOpen: false, setAiPanelOpen }),
}));

import { ExplorerWorkspace } from "@/components/explorer/ExplorerWorkspace";

describe("ExplorerWorkspace", () => {
  afterEach(() => cleanup());

  it("renders a sidebar rail with theme and settings icons", () => {
    render(<ExplorerWorkspace />);
    expect(screen.getByRole("button", { name: /Theme:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it("clicking the theme icon cycles the theme preference", () => {
    render(<ExplorerWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Theme:/ }));
    expect(cyclePreference).toHaveBeenCalledTimes(1);
  });

  it("clicking Settings navigates to the settings app view", () => {
    render(<ExplorerWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(setAppView).toHaveBeenCalledWith("settings");
  });

  it("clicking the assistant icon toggles the AI panel", () => {
    render(<ExplorerWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    expect(setAiPanelOpen).toHaveBeenCalledTimes(1);
  });
});
