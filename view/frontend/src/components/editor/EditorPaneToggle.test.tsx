/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorPaneToggle } from "@/components/editor/EditorPaneToggle";
import type { EditorVisiblePanes } from "@/lib/editorVisiblePanes";

afterEach(() => {
  cleanup();
});

function renderToggle(
  visiblePanes: EditorVisiblePanes = { outline: true, draft: true, notes: false },
) {
  const onVisiblePanesChange = vi.fn();
  const onActivePaneChange = vi.fn();
  render(
    <EditorPaneToggle
      visiblePanes={visiblePanes}
      onVisiblePanesChange={onVisiblePanesChange}
      activePane="draft"
      onActivePaneChange={onActivePaneChange}
      showNotes
    />,
  );
  return { onVisiblePanesChange, onActivePaneChange };
}

describe("EditorPaneToggle", () => {
  it("renders Outline, Draft, and Notes as independent pane toggles", () => {
    renderToggle();

    expect(screen.getByRole("button", { name: "Outline" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Draft" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Notes" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("allows selecting notes without closing outline or draft", () => {
    const { onVisiblePanesChange, onActivePaneChange } = renderToggle();

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    expect(onVisiblePanesChange).toHaveBeenCalledWith({
      outline: true,
      draft: true,
      notes: true,
    });
    expect(onActivePaneChange).toHaveBeenCalledWith("notes");
  });

  it("does not allow hiding the last visible pane", () => {
    renderToggle({ outline: true, draft: false, notes: false });

    expect(screen.getByRole("button", { name: "Outline" }).hasAttribute("disabled")).toBe(true);
  });
});
