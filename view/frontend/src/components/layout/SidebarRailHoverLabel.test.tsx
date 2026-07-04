/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarRailHoverLabel } from "@/components/layout/SidebarRailHoverLabel";

describe("SidebarRailHoverLabel", () => {
  afterEach(() => cleanup());

  it("shows a flyout label to the right on hover", () => {
    render(
      <SidebarRailHoverLabel label="Paper">
        <button type="button">Icon</button>
      </SidebarRailHoverLabel>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeTruthy();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Icon" }));
    expect(screen.getByRole("tooltip").textContent).toBe("Paper");
    fireEvent.mouseLeave(screen.getByRole("button", { name: "Icon" }));
    expect(screen.queryByRole("tooltip")).not.toBeTruthy();
  });

  it("does not render hover label when disabled", () => {
    render(
      <SidebarRailHoverLabel label="Paper" enabled={false}>
        <button type="button">Icon</button>
      </SidebarRailHoverLabel>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Icon" }));
    expect(screen.queryByRole("tooltip")).not.toBeTruthy();
  });
});
