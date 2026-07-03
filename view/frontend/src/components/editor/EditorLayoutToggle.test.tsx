/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

import { EditorLayoutToggle } from "@/components/editor/EditorLayoutToggle";

describe("EditorLayoutToggle", () => {
  afterEach(() => cleanup());

  it("fires onLayoutChange with the clicked layout", () => {
    const onLayoutChange = vi.fn();
    render(<EditorLayoutToggle layout="preview" onLayoutChange={onLayoutChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(onLayoutChange).toHaveBeenCalledWith("source");

    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(onLayoutChange).toHaveBeenCalledWith("split");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(onLayoutChange).toHaveBeenCalledWith("preview");
  });

  it("highlights the active layout button", () => {
    render(<EditorLayoutToggle layout="split" onLayoutChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Split" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Source" }).className).not.toContain("bg-primary");
  });
});
