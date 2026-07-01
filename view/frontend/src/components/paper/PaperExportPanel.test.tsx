/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

import { PaperExportPanel } from "@/components/paper/PaperExportPanel";

vi.mock("@/modelApi", () => ({
  connectOverleaf: vi.fn(),
  exportPaper: vi.fn(),
  exportPaperBatch: vi.fn(),
  fetchOverleafStatus: vi.fn().mockResolvedValue({ connected: false }),
  fetchPaperDetail: vi.fn(),
  importOverleafFeedback: vi.fn(),
  pushToOverleaf: vi.fn(),
}));

const { fetchPaperDetail } = await import("@/modelApi");

describe("PaperExportPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchPaperDetail).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Overleaf controls for journal papers", async () => {
    vi.mocked(fetchPaperDetail).mockResolvedValue({
      paper: { docType: "paper" } as Awaited<ReturnType<typeof fetchPaperDetail>>["paper"],
    });

    render(<PaperExportPanel paperSlug="demo" onError={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Overleaf")).toBeTruthy();
    });
    expect(screen.queryByText(/Overleaf sync is available for journal papers only/i)).toBeNull();
  });

  it("hides Overleaf controls for grants and emphasizes Word export", async () => {
    vi.mocked(fetchPaperDetail).mockResolvedValue({
      paper: { docType: "grant" } as Awaited<ReturnType<typeof fetchPaperDetail>>["paper"],
    });

    render(<PaperExportPanel paperSlug="nsf-demo" onError={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Overleaf sync is available for journal papers only/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Connect Overleaf/i })).toBeNull();
    const wordButton = screen.getByRole("button", { name: "Word" });
    expect(wordButton.className).toContain("bg-primary");
  });
});
