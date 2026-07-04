/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WorkspaceModePill } from "@/components/layout/WorkspaceModePill";

describe("WorkspaceModePill", () => {
  afterEach(() => cleanup());

  it("renders both Write and Explorer buttons", () => {
    render(<WorkspaceModePill explorerMode={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Write" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorer" })).toBeTruthy();
  });

  it("reflects explorerMode in the active button", () => {
    render(<WorkspaceModePill explorerMode={true} onChange={vi.fn()} />);
    const explorer = screen.getByRole("button", { name: "Explorer" });
    expect(explorer.getAttribute("aria-pressed")).toBe("true");
    expect(explorer.className.includes("text-primary")).toBe(true);
    expect(screen.getByRole("button", { name: "Write" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with the clicked mode's boolean", () => {
    const onChange = vi.fn();
    render(<WorkspaceModePill explorerMode={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Explorer" }));
    expect(onChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
