/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DocxImportActionButton } from "@/components/paper/DocxImportActionButton";
import { DocxImportModalProvider } from "@/components/paper/DocxImportModalContext";

vi.mock("@/components/paper/DocxImportModal", () => ({
  DocxImportModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Import from Word" /> : null,
}));

function renderButton() {
  return render(
    <DocxImportModalProvider
      paperSlug="demo"
      onError={vi.fn()}
    >
      <DocxImportActionButton iconOnly paperSlug="demo" />
    </DocxImportModalProvider>,
  );
}

describe("DocxImportActionButton", () => {
  afterEach(() => cleanup());

  it("opens the import modal when clicked", () => {
    renderButton();
    expect(screen.queryByRole("dialog", { name: "Import from Word" })).not.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import from Word" }));
    expect(screen.getByRole("dialog", { name: "Import from Word" })).toBeTruthy();
  });
});
