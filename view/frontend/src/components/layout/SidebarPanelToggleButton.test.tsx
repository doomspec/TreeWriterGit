/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  resolveSidebarPanelLayoutMode,
  SidebarPanelToggleButton,
} from "@/components/layout/SidebarPanelToggleButton";

describe("SidebarPanelToggleButton", () => {
  afterEach(() => cleanup());

  it("resolves layout modes from open and pinned state", () => {
    expect(resolveSidebarPanelLayoutMode(false, false)).toBe("collapsed");
    expect(resolveSidebarPanelLayoutMode(false, true)).toBe("collapsed");
    expect(resolveSidebarPanelLayoutMode(true, false)).toBe("expanded");
    expect(resolveSidebarPanelLayoutMode(true, true)).toBe("pinned");
  });

  it("shows pin label when expanded and unpinned", () => {
    render(
      <SidebarPanelToggleButton panelOpen pinned={false} onCycle={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Pin sidebar panel" })).toBeTruthy();
  });

  it("calls onCycle when clicked", () => {
    const onCycle = vi.fn();
    render(
      <SidebarPanelToggleButton panelOpen={false} pinned={false} onCycle={onCycle} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar panel" }));
    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
