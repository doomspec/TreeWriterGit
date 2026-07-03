import { describe, expect, it } from "vitest";

import {
  buildCreateManuscriptPayload,
  parseSectionOrder,
  structurePreviewFolders,
  validateManuscriptCreate,
} from "@/lib/manuscriptForm";
import type { ManuscriptTemplate } from "@/modelApi";

const GRANT_TEMPLATE: ManuscriptTemplate = {
  templateId: "nsf-research-proposal",
  docType: "grant",
  label: "NSF",
  description: "",
  targetWords: 15000,
  sectionOrder: ["specific-aims"],
  statusOptions: ["Planning"],
  assetDirs: [],
  notesDirs: ["literature", "budget"],
  requiredFields: ["funder"],
  exportPrimaryFormat: "docx",
};

describe("manuscriptForm", () => {
  it("parseSectionOrder splits lines", () => {
    expect(parseSectionOrder("intro\n\nmethods\n")).toEqual(["intro", "methods"]);
  });

  it("validateManuscriptCreate requires funder for grants", () => {
    expect(
      validateManuscriptCreate({
        title: "Demo",
        targetWords: "5000",
        sectionOrderText: "intro",
        docType: "grant",
        template: GRANT_TEMPLATE,
      }),
    ).toMatch(/Funder/);
  });

  it("buildCreateManuscriptPayload omits overleaf for grants", () => {
    const payload = buildCreateManuscriptPayload({
      title: "Grant",
      docType: "grant",
      templateId: "nsf-research-proposal",
      authors: ["PI"],
      slug: "",
      targetWords: "5000",
      sectionOrderText: "specific-aims",
      status: "Planning",
      overleafRepoPath: "/tmp",
      funder: "NSF",
      program: "",
      deadline: "",
      audience: "",
      tags: "nsf, 2026",
      project: "demo",
      contributionMode: "kernel",
      agentSummary: "Summary",
    });
    expect(payload.docType).toBe("grant");
    expect(payload.overleafRepoPath).toBeNull();
    expect(payload.funder).toBe("NSF");
    expect(payload.tags).toEqual(["nsf", "2026"]);
    expect(payload.contributionMode).toBe("kernel");
    expect(payload.authors).toEqual(["PI"]);
  });

  it("buildCreateManuscriptPayload carries affiliations and per-author mapping", () => {
    const payload = buildCreateManuscriptPayload({
      title: "Paper",
      docType: "paper",
      templateId: "nature",
      journal: "Nature",
      authors: ["Ada", "Alan"],
      affiliations: ["Cambridge", "Bletchley"],
      authorAffiliations: [[1], [1, 2]],
      slug: "",
      targetWords: "3000",
      sectionOrderText: "introduction",
      status: "Planning",
      overleafRepoPath: "",
      funder: "",
      program: "",
      deadline: "",
      audience: "",
      tags: "",
      project: "",
      contributionMode: "",
      agentSummary: "",
    });
    expect(payload.authors).toEqual(["Ada", "Alan"]);
    expect(payload.affiliations).toEqual(["Cambridge", "Bletchley"]);
    expect(payload.authorAffiliations).toEqual([[1], [1, 2]]);
  });

  it("buildCreateManuscriptPayload omits affiliations when none are given", () => {
    const payload = buildCreateManuscriptPayload({
      title: "Paper",
      docType: "paper",
      templateId: "nature",
      journal: "Nature",
      authors: ["Ada"],
      affiliations: [],
      authorAffiliations: [],
      slug: "",
      targetWords: "3000",
      sectionOrderText: "introduction",
      status: "Planning",
      overleafRepoPath: "",
      funder: "",
      program: "",
      deadline: "",
      audience: "",
      tags: "",
      project: "",
      contributionMode: "",
      agentSummary: "",
    });
    expect(payload.affiliations).toBeUndefined();
    expect(payload.authorAffiliations).toBeUndefined();
  });

  it("structurePreviewFolders lists sections notes and assets", () => {
    expect(structurePreviewFolders(GRANT_TEMPLATE)).toEqual([
      "specific-aims/",
      "notes/literature/",
      "notes/budget/",
    ]);
  });
});

describe("defaultGuidePaper", () => {
  it("prefers guide slug when present", async () => {
    const { preferDefaultManuscriptSlug } = await import("@/lib/defaultGuidePaper");
    expect(
      preferDefaultManuscriptSlug([
        { slug: "other", docType: "paper" } as import("@/modelApi").PaperSummary,
        { slug: "treewriter-guide", docType: "paper" } as import("@/modelApi").PaperSummary,
      ]),
    ).toBe("treewriter-guide");
  });

  it("prefers doc type when specified", async () => {
    const { preferDefaultManuscriptSlug } = await import("@/lib/defaultGuidePaper");
    expect(
      preferDefaultManuscriptSlug(
        [
          { slug: "treewriter-guide", docType: "paper" } as import("@/modelApi").PaperSummary,
          { slug: "my-grant", docType: "grant" } as import("@/modelApi").PaperSummary,
        ],
        "grant",
      ),
    ).toBe("my-grant");
  });
});
