/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarPanelNav } from "@/components/layout/SidebarPanelNav";

function baseProps(overrides: Partial<React.ComponentProps<typeof SidebarPanelNav>> = {}) {
  return {
    activePanel: "paperInfo" as const,
    panelOpen: true,
    graphAvailable: true,
    appView: "workspace" as const,
    onSelectPanel: vi.fn(),
    onSetAppView: vi.fn(),
    ...overrides,
  };
}

describe("SidebarPanelNav", () => {
  afterEach(() => cleanup());

  it("renders panel icons in a vertical column", () => {
    render(<SidebarPanelNav {...baseProps()} />);
    expect(screen.getByRole("button", { name: "Sections" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paper" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assets" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Removed" })).toBeTruthy();
  });

  it("selects a panel on click", () => {
    const onSelectPanel = vi.fn();
    render(<SidebarPanelNav {...baseProps({ onSelectPanel })} />);
    fireEvent.click(screen.getByRole("button", { name: "Sections" }));
    expect(onSelectPanel).toHaveBeenCalledWith("papers");
  });

  it("shows hover label for icon-only rail buttons", () => {
    render(<SidebarPanelNav {...baseProps()} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Paper" }));
    expect(screen.getByRole("tooltip").textContent).toBe("Paper");
  });
});
