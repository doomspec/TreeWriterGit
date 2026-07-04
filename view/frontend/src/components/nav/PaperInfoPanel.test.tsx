/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PaperInfoPanel } from "@/components/nav/PaperInfoPanel";
import type { PaperDetail } from "@/modelApi";

vi.mock("@/components/paper/DocxImportActionButton", () => ({
  DocxImportActionButton: () => (
    <button type="button" aria-label="Import from Word">
      Import
    </button>
  ),
}));

vi.mock("@/modelApi", () => ({
  fetchPaperDetail: vi.fn(),
  deletePaper: vi.fn(),
  updateManuscript: vi.fn(),
}));

vi.mock("@/components/paper/NewManuscriptModal", () => ({
  NewManuscriptModal: ({ editSlug, initialTab }: { editSlug?: string; initialTab?: string }) =>
    editSlug ? (
      <div data-testid="edit-manuscript-modal" data-initial-tab={initialTab ?? "details"} />
    ) : null,
}));

vi.mock("@/lib/usePaperList", () => ({
  usePaperList: () => ({ papers: [], loading: false }),
}));

const { fetchPaperDetail, updateManuscript } = await import("@/modelApi");

const EMPTY_COUNTS = { outline: 0, drafted: 0, approved: 0, total: 0 };

const DETAIL: PaperDetail = {
  slug: "vibecount",
  path: "papers/vibecount",
  title: "VibeCount",
  docType: "paper" as const,
  journal: "PLOS ONE",
  status: "drafting",
  lastExport: null,
  tags: [],
  project: null,
  counts: EMPTY_COUNTS,
  templateId: "plos-one",
  templateLabel: "PLOS ONE template",
  draftWordCount: 1200,
  authorDetails: [
    {
      firstName: "Ada",
      lastName: "Lovelace",
      affiliations: [1],
      orcid: "0000-0002-1825-0097",
      equalContribution: true,
      credit: ["Software"],
    },
    {
      firstName: "Alan",
      lastName: "Turing",
      affiliations: [1, 2],
      corresponding: true,
      email: "alan@x.org",
    },
  ],
  authors: ["Ada Lovelace", "Alan Turing"],
  affiliations: ["Cambridge", "Bletchley"],
  authorAffiliations: [[1], [1, 2]],
  targetWords: 3000,
  sectionOrder: [],
  overleafRepoPath: null,
  overleafGitUrl: null,
  funder: null,
  program: null,
  deadline: null,
  audience: null,
  contributionMode: null,
  agentSummary: null,
  sections: [],
  containerCounts: {},
  containerWordCounts: {},
  pendingApprovalPaths: [],
  pendingReviews: [],
};

const baseProps = {
  tree: [],
  refreshVersion: 0,
  onNavigate: vi.fn(),
  onPaperCreated: vi.fn(),
  onModelChanged: vi.fn(),
  onError: vi.fn(),
};

describe("PaperInfoPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchPaperDetail).mockReset();
    vi.mocked(updateManuscript).mockReset();
    vi.mocked(fetchPaperDetail).mockResolvedValue({ paper: DETAIL });
    vi.mocked(updateManuscript).mockResolvedValue({ ok: true, slug: "vibecount", path: "papers/vibecount" });
  });

  afterEach(() => cleanup());

  it("prompts to select a paper when none is active", () => {
    render(<PaperInfoPanel {...baseProps} currentPath="papers" />);
    expect(screen.getByText(/select a paper to see its details/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manuscript" })).toBeTruthy();
  });

  it("shows stats, authors, affiliations, and CRediT roles for the active paper", async () => {
    render(<PaperInfoPanel {...baseProps} currentPath="papers/vibecount" />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Import from Word" })).toBeTruthy();
    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByText(/1,200 \/ 3,000/)).toBeTruthy();
    expect(screen.getByText("PLOS ONE template")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Info" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Authors" })).toBeTruthy();
    expect(screen.getByText("Alan Turing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contributions (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Contributions (1)" }));
    expect(screen.getByText("Software")).toBeTruthy();
    expect(screen.getByText("Cambridge")).toBeTruthy();
  });

  it("shows an add-author control in the Authors section header", async () => {
    render(<PaperInfoPanel {...baseProps} currentPath="papers/vibecount" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add author" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Add author" }));
    expect(screen.getByTestId("edit-manuscript-modal").getAttribute("data-initial-tab")).toBe("authors");
  });

  it("shows edit and remove controls for each author", async () => {
    render(<PaperInfoPanel {...baseProps} currentPath="papers/vibecount" />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Edit Ada Lovelace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Alan Turing" })).toBeTruthy();
  });

  it("opens the manuscript editor on the authors tab when editing an author", async () => {
    render(<PaperInfoPanel {...baseProps} currentPath="papers/vibecount" />);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit Ada Lovelace" }));
    const modal = screen.getByTestId("edit-manuscript-modal");
    expect(modal.getAttribute("data-initial-tab")).toBe("authors");
  });

  it("removes an author after confirmation", async () => {
    const onModelChanged = vi.fn();
    const updatedDetail = {
      ...DETAIL,
      authorDetails: [DETAIL.authorDetails[0]],
      authors: ["Ada Lovelace"],
    };
    vi.mocked(fetchPaperDetail)
      .mockResolvedValueOnce({ paper: DETAIL })
      .mockResolvedValueOnce({ paper: updatedDetail });
    render(<PaperInfoPanel {...baseProps} currentPath="papers/vibecount" onModelChanged={onModelChanged} />);
    await waitFor(() => expect(screen.getByText("Alan Turing")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Remove Alan Turing" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove author" }));
    await waitFor(() => expect(updateManuscript).toHaveBeenCalledOnce());
    expect(onModelChanged).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Alan Turing")).toBeNull());
  });
});
