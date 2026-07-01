import { describe, expect, it } from "vitest";

import type { PaperSummary } from "@/modelApi";
import { defaultPaperPath, preferDefaultManuscriptSlug, preferDefaultPaperSlug } from "@/lib/defaultGuidePaper";

function paper(slug: string, title: string, docType: PaperSummary["docType"] = "paper"): PaperSummary {
  return {
    slug,
    title,
    path: `papers/${slug}`,
    docType,
    journal: "",
    status: "draft",
    lastExport: null,
    tags: [],
    project: null,
    counts: { approved: 0, drafted: 0, outline: 0, total: 0 },
  };
}

describe("defaultGuidePaper", () => {
  it("prefers treewriter-guide when present", () => {
    const papers = [paper("vibecount", "VibeCount"), paper("treewriter-guide", "TreeWriter Guide")];
    expect(preferDefaultPaperSlug(papers)).toBe("treewriter-guide");
    expect(defaultPaperPath(papers)).toBe("papers/treewriter-guide");
  });

  it("falls back to first paper when guide is absent", () => {
    const papers = [paper("alpha", "Alpha")];
    expect(preferDefaultPaperSlug(papers)).toBe("alpha");
  });

  it("prefers grant when doc type filter is grant", () => {
    const papers = [
      paper("treewriter-guide", "Guide"),
      paper("nsf-demo", "NSF Demo", "grant"),
    ];
    expect(preferDefaultManuscriptSlug(papers, "grant")).toBe("nsf-demo");
  });
});
