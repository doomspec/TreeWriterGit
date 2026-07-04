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

const PAPER_TEMPLATE = {
  templateId: "nature",
  docType: "paper" as const,
  label: "Nature",
  description: "Nature article",
  journal: "Nature",
  targetWords: 3000,
  sectionOrder: ["introduction", "results"],
  statusOptions: ["Planning"],
  assetDirs: [],
  notesDirs: [],
  requiredFields: ["journal"],
  exportPrimaryFormat: "latex" as const,
};

vi.mock("@/modelApi", () => ({
  createManuscript: vi.fn().mockResolvedValue({ path: "papers/nsf-demo", slug: "nsf-demo" }),
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

  it("goes straight from type to details (no template-list step) and submits the grant payload", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [GRANT_TEMPLATE] });

    const onCreated = vi.fn();
    render(<NewManuscriptModal onClose={vi.fn()} onCreated={onCreated} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));

    // Details form is visible immediately — no intermediate template-list screen.
    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

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

  it("offers a template dropdown in the Details tab that reapplies template settings", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({
      templates: [GRANT_TEMPLATE, { ...GRANT_TEMPLATE, templateId: "nih-r01", label: "NIH R01" }],
    });
    render(<NewManuscriptModal onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => expect(screen.getByLabelText(/Template/i)).toBeTruthy());

    const select = screen.getByLabelText(/Template/i) as HTMLSelectElement;
    expect(select.value).toBe("nsf-research-proposal");
    fireEvent.change(select, { target: { value: "nih-r01" } });
    expect(select.value).toBe("nih-r01");
  });

  it("exposes Details / Authors / Contributions / Structure / Advanced tabs", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [GRANT_TEMPLATE] });
    render(<NewManuscriptModal onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeTruthy());

    expect(screen.getByRole("button", { name: "Authors & affiliations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contributions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Structure" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Advanced" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Authors & affiliations" }));
    expect(screen.getByRole("button", { name: /^Author$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Structure" }));
    expect(screen.getByLabelText(/Section order/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByLabelText(/Status/i)).toBeTruthy();
  });

  it("validates required grant fields before submit", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [GRANT_TEMPLATE] });
    const onError = vi.fn();

    render(<NewManuscriptModal onClose={vi.fn()} onCreated={vi.fn()} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: "Missing funder" } });
    fireEvent.click(screen.getByRole("button", { name: /Create manuscript/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Funder/i));
    });
    expect(createManuscript).not.toHaveBeenCalled();
  });

  it("creates the manuscript and opens the Word import panel from 'Create & import from Word…'", async () => {
    vi.mocked(fetchManuscriptTemplates).mockResolvedValue({ templates: [PAPER_TEMPLATE] });
    render(<NewManuscriptModal onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Paper" }));
    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: "Import Demo" } });

    fireEvent.click(screen.getByRole("button", { name: /Create & import from Word/i }));

    await waitFor(() => expect(createManuscript).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByText(/Choose or drop a \.docx file/i)).toBeTruthy());
  });
});
