/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorPaneModeToggle } from "@/components/editor/EditorPaneModeToggle";

describe("EditorPaneModeToggle", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render the clean-preview button when there is no pending diff", () => {
    const { queryByTitle } = render(
      <EditorPaneModeToggle paneMode="rendered" onPaneModeChange={vi.fn()} ariaLabel="test" />,
    );
    expect(queryByTitle(/clean preview/i)).toBeNull();
  });

  it("renders and toggles the clean-preview button when a pending diff is available", () => {
    const onCleanPreviewChange = vi.fn();
    const { getByTitle } = render(
      <EditorPaneModeToggle
        paneMode="rendered"
        onPaneModeChange={vi.fn()}
        ariaLabel="test"
        pendingDiffAvailable
        cleanPreview={false}
        onCleanPreviewChange={onCleanPreviewChange}
      />,
    );
    const button = getByTitle(/show clean preview/i);
    fireEvent.click(button);
    expect(onCleanPreviewChange).toHaveBeenCalledWith(true);
  });

  it("reflects the active clean-preview state in its title", () => {
    const { getByTitle } = render(
      <EditorPaneModeToggle
        paneMode="rendered"
        onPaneModeChange={vi.fn()}
        ariaLabel="test"
        pendingDiffAvailable
        cleanPreview
        onCleanPreviewChange={vi.fn()}
      />,
    );
    expect(getByTitle(/showing clean text/i)).toBeTruthy();
  });
});
