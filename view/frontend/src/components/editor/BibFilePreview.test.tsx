/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { BibFilePreview } from "@/components/editor/BibFilePreview";
import { WorkspaceNavigationProvider } from "@/lib/workspace/WorkspaceNavigationContext";

const ensureBibEntry = vi.fn();
const searchBibReferences = vi.fn();

vi.mock("@/lib/bibLibraryStore", () => ({
  ensureBibEntry: (...args: unknown[]) => ensureBibEntry(...args),
  invalidateBibLibrary: vi.fn(),
  searchBibReferences: (...args: unknown[]) => searchBibReferences(...args),
}));

vi.mock("@/lib/bibLibraryContext", () => ({
  useBibLibrarySummary: () => ({
    summary: { total: 2, verified: 0, stale: 0, unverified: 2, mtime: 1 },
    loading: false,
    reload: vi.fn(),
  }),
}));

vi.mock("@/lib/useWindowWidth", () => ({
  useWindowWidth: () => 1400,
}));

function renderPreview(options: { hideEntryList?: boolean; selectedBibCiteKey?: string | null }) {
  const setSelectedBibCiteKey = vi.fn();
  render(
    <WorkspaceNavigationProvider
      value={
        {
          selectedBibCiteKey: options.selectedBibCiteKey ?? null,
          setSelectedBibCiteKey,
          sidebarPanel: "references",
          sidebarPanelOpen: options.hideEntryList ?? false,
        } as never
      }
    >
      <div style={{ height: 600, display: "flex" }}>
        <BibFilePreview
          filePath="main.bib"
          onError={vi.fn()}
          hideEntryList={options.hideEntryList}
        />
      </div>
    </WorkspaceNavigationProvider>,
  );
  return { setSelectedBibCiteKey };
}

describe("BibFilePreview", () => {
  beforeEach(() => {
    ensureBibEntry.mockReset();
    searchBibReferences.mockReset();
    searchBibReferences.mockResolvedValue({
      total: 2,
      entries: [
        {
          path: "main.bib#alpha",
          citeKey: "alpha",
          title: "Alpha",
          authors: null,
          year: "2024",
          journal: null,
          type: "article",
          verifiedStatus: "unverified",
        },
        {
          path: "main.bib#beta",
          citeKey: "beta",
          title: "Beta",
          authors: null,
          year: "2023",
          journal: null,
          type: "article",
          verifiedStatus: "unverified",
        },
      ],
    });
    ensureBibEntry.mockImplementation(async (citeKey: string) => ({
      citeKey,
      type: "article",
      fields: { title: citeKey },
      verifiedStatus: "unverified",
      integrity: null,
    }));
  });

  it("loads the sidebar-selected cite key when the internal list is hidden", async () => {
    renderPreview({ hideEntryList: true, selectedBibCiteKey: "beta" });

    await waitFor(() => {
      expect(ensureBibEntry).toHaveBeenCalledWith("beta");
    });
    expect(ensureBibEntry).not.toHaveBeenCalledWith("alpha");
  });

  it("skips list search when the internal list is hidden", async () => {
    renderPreview({ hideEntryList: true, selectedBibCiteKey: "beta" });

    await waitFor(() => {
      expect(ensureBibEntry).toHaveBeenCalledWith("beta");
    });
    expect(searchBibReferences).not.toHaveBeenCalled();
  });

  it("shows sidebar selection hint when no entry is selected", async () => {
    renderPreview({ hideEntryList: true, selectedBibCiteKey: null });

    await waitFor(() => {
      expect(screen.getByText(/select a reference from the sidebar/i)).toBeTruthy();
    });
  });
});
