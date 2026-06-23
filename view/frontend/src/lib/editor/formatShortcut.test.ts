import { describe, expect, it, vi } from "vitest";

import { handleFormatShortcut } from "@/lib/editor/formatShortcut";

describe("handleFormatShortcut", () => {
  it("applies bold on meta+b", () => {
    const onFormat = vi.fn();
    const event = {
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      key: "b",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    expect(handleFormatShortcut(event, onFormat)).toBe(true);
    expect(onFormat).toHaveBeenCalledWith("bold");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("ignores plain key presses", () => {
    const onFormat = vi.fn();
    const event = {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      key: "b",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    expect(handleFormatShortcut(event, onFormat)).toBe(false);
    expect(onFormat).not.toHaveBeenCalled();
  });
});
