/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const fetchDocxPreview = vi.fn(async (..._args: unknown[]) => ({ markdown: "# Converted\n\nBody text." }));
vi.mock("@/modelApi", () => ({ fetchDocxPreview: (...args: unknown[]) => fetchDocxPreview(...args) }));

import { ExplorerDocxViewer } from "@/components/explorer/viewers/ExplorerDocxViewer";

describe("ExplorerDocxViewer", () => {
  afterEach(() => cleanup());

  it("renders the server-converted markdown read-only", async () => {
    render(<ExplorerDocxViewer path="explorer/report.docx" />);
    expect(await screen.findByText("Converted")).toBeTruthy();
    expect(screen.getByText("Body text.")).toBeTruthy();
    expect(screen.getByText("Read-only")).toBeTruthy();
  });

  it("surfaces a conversion error", async () => {
    fetchDocxPreview.mockRejectedValueOnce(new Error("pandoc not installed"));
    const onError = vi.fn();
    render(<ExplorerDocxViewer path="explorer/report.docx" onError={onError} />);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("pandoc not installed");
    });
    expect(screen.getByText("pandoc not installed")).toBeTruthy();
  });
});
