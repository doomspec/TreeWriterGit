/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ExplorerSidebarRail } from "@/components/explorer/ExplorerSidebarRail";

const baseProps = {
  themePreference: "light" as const,
  onCycleTheme: () => {},
  appView: "workspace" as const,
  onSetAppView: () => {},
  aiPanelOpen: false,
  onToggleAiPanel: () => {},
};

describe("ExplorerSidebarRail", () => {
  afterEach(() => cleanup());

  it("shows assistant, theme, guide, and settings icons", () => {
    render(<ExplorerSidebarRail {...baseProps} />);
    expect(screen.getByRole("button", { name: "Open AI assistant" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Theme:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guide and workspace status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it("cycles theme on click", () => {
    const onCycleTheme = vi.fn();
    render(<ExplorerSidebarRail {...baseProps} themePreference="dark" onCycleTheme={onCycleTheme} />);
    fireEvent.click(screen.getByRole("button", { name: /Theme:/ }));
    expect(onCycleTheme).toHaveBeenCalledTimes(1);
  });

  it("toggles the AI assistant panel and reflects open state", () => {
    const onToggleAiPanel = vi.fn();
    const { rerender } = render(<ExplorerSidebarRail {...baseProps} onToggleAiPanel={onToggleAiPanel} />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    expect(onToggleAiPanel).toHaveBeenCalledTimes(1);

    rerender(<ExplorerSidebarRail {...baseProps} aiPanelOpen onToggleAiPanel={onToggleAiPanel} />);
    expect(screen.getByRole("button", { name: "Close AI assistant" })).toBeTruthy();
  });

  it("toggles settings view on/off", () => {
    const onSetAppView = vi.fn();
    const { rerender } = render(<ExplorerSidebarRail {...baseProps} onSetAppView={onSetAppView} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onSetAppView).toHaveBeenCalledWith("settings");

    rerender(<ExplorerSidebarRail {...baseProps} appView="settings" onSetAppView={onSetAppView} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onSetAppView).toHaveBeenCalledWith("workspace");
  });
});
