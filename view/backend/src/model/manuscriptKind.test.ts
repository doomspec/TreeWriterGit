import { describe, expect, it } from "vitest";

import {
  buildManuscriptManifestBlock,
  contributionModeFromIndex,
  docTypeFromIndex,
  isManuscriptRoot,
} from "./manuscriptKind.js";

describe("manuscriptKind", () => {
  it("isManuscriptRoot accepts paper and manuscript kinds", () => {
    expect(isManuscriptRoot({ kind: "paper" })).toBe(true);
    expect(isManuscriptRoot({ kind: "manuscript" })).toBe(true);
    expect(isManuscriptRoot({ kind: "section" })).toBe(false);
  });

  it("docTypeFromIndex defaults to paper", () => {
    expect(docTypeFromIndex({})).toBe("paper");
    expect(docTypeFromIndex({ doc_type: "grant" })).toBe("grant");
    expect(docTypeFromIndex({ doc_type: "report" })).toBe("report");
  });

  it("contributionModeFromIndex parses kernel and repository", () => {
    expect(contributionModeFromIndex({ contribution_mode: "kernel" })).toBe("kernel");
    expect(contributionModeFromIndex({})).toBeNull();
  });

  it("buildManuscriptManifestBlock includes manifest fields", () => {
    const block = buildManuscriptManifestBlock({
      doc_type: "grant",
      template_id: "nsf-research-proposal",
      project: "roboculture",
      tags: ["nsf", "2026"],
      contribution_mode: "kernel",
      funder: "NSF",
      agent_summary: "Test summary",
    });
    expect(block).toContain("doc_type: grant");
    expect(block).toContain("project: roboculture");
    expect(block).toContain("contribution_mode: kernel");
    expect(block).toContain("funder: NSF");
  });
});
