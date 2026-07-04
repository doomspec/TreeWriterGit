/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MarkdownToolbar } from "@/components/editor/MarkdownToolbar";

describe("MarkdownToolbar", () => {
  beforeEach(() => {
    // happy-dom doesn't provide window.localStorage by default; HighlightToolbarButton reads it on mount.
    if (!window.localStorage) {
      const store = new Map<string, string>();
      window.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      } as Storage;
    }
  });

  afterEach(() => cleanup());

  it("shows the Comment and Note buttons by default", () => {
    render(<MarkdownToolbar onFormat={vi.fn()} onToggleComments={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Comment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Note" })).toBeTruthy();
  });

  it("hides the Comment and Note buttons when hideComments is set, for surfaces with no review workflow", () => {
    render(<MarkdownToolbar onFormat={vi.fn()} hideComments />);
    expect(screen.queryByRole("button", { name: "Comment" })).not.toBeTruthy();
    expect(screen.queryByRole("button", { name: "Note" })).not.toBeTruthy();
  });

  it("still shows plain formatting tools when hideComments is set", () => {
    render(<MarkdownToolbar onFormat={vi.fn()} hideComments />);
    fireEvent.click(screen.getByRole("button", { name: "Formatting tools" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("menuitemcheckbox", { name: "Italic" })).toBeTruthy();
  });

  it("hides highlight when onInsertHighlight is not provided", () => {
    render(<MarkdownToolbar onFormat={vi.fn()} hideComments />);
    expect(screen.queryByRole("button", { name: "Highlight selection" })).not.toBeTruthy();
  });

  it("uses a single-row nowrap control strip when embedded", () => {
    const { container } = render(
      <MarkdownToolbar embedded onFormat={vi.fn()} onToggleComments={vi.fn()} />,
    );
    const controls = container.querySelector(".markdown-toolbar__controls");
    expect(controls?.className).toContain("flex-nowrap");
    expect(controls?.className).not.toContain("flex-wrap");
    expect(controls?.className).toContain("w-max");
  });
});
