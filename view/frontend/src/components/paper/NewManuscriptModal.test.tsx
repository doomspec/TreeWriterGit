/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";

import { NewManuscriptModal } from "@/components/paper/NewManuscriptModal";

const GRANT_TEMPLATE = {
  templateId: "nsf-research-proposal",
  docType: "grant" as const,
  label: "NSF Research Proposal",
  description: "Standard NSF layout",
  targetWords: 15000,
  sectionOrder: ["specific-aims", "background"],
  statusOptions: ["Planning"],
  assetDirs: [],
  notesDirs: ["literature", "budget"],
  requiredFields: ["funder"],
  exportPrimaryFormat: "docx" as const,
};

vi.mock("@/modelApi", () => ({
  createManuscript: vi.fn().mockResolvedValue({ path: "papers/nsf-demo" }),
  fetchManuscriptTemplates: vi.fn(),
  fetchPaperDetail: vi.fn(),
  updateManuscript: vi.fn(),
}));

const { createManuscript, fetchManuscriptTemplates } = await import("@/modelApi");

describe("NewManuscriptModal", () => {
  beforeEach(() => {
    vi.mocked(fetchManuscriptTemplates).mockReset();
    vi.mocked(createManuscript).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("walks type → template → metadata and submits grant payload without Overleaf", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [GRANT_TEMPLATE] });

    const onCreated = vi.fn();
    render(
      <NewManuscriptModal onClose={vi.fn()} onCreated={onCreated} onError={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => {
      expect(screen.getByText("NSF Research Proposal")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: "NSF Demo" } });
    fireEvent.change(screen.getByPlaceholderText(/NSF, NIH/i), { target: { value: "NSF" } });
    fireEvent.click(screen.getByRole("button", { name: /Create manuscript/i }));

    await waitFor(() => {
      expect(createManuscript).toHaveBeenCalledOnce();
    });
    const payload = vi.mocked(createManuscript).mock.calls[0]?.[0];
    expect(payload?.docType).toBe("grant");
    expect(payload?.funder).toBe("NSF");
    expect(payload?.overleafRepoPath).toBeNull();
    expect(onCreated).toHaveBeenCalledWith("papers/nsf-demo");
  });

  it("validates required grant fields before submit", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [GRANT_TEMPLATE] });
    const onError = vi.fn();

    render(<NewManuscriptModal onClose={vi.fn()} onCreated={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => expect(screen.getByText("NSF Research Proposal")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: "Missing funder" } });
    fireEvent.click(screen.getByRole("button", { name: /Create manuscript/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Funder/i));
    });
    expect(createManuscript).not.toHaveBeenCalled();
  });
});
