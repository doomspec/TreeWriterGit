import { describe, expect, it } from "vitest";

import { ModelFsError } from "../modelFs.js";
import { appendPandocExportStyleArgs } from "../journalExportStyle.js";
import { prepareMarkdownForLatexExport } from "../exportMarkdown.js";
import { assertExportAllowed } from "./runExportPipeline.js";

describe("runExportPipeline", () => {
  it("prepares markdown for latex export", async () => {
    const out = await prepareMarkdownForLatexExport("Hello **world**");
    expect(out).toContain("world");
  });

  it("appends journal style pandoc args", () => {
    const args: string[] = [];
    appendPandocExportStyleArgs(args, {
      documentclass: "article",
      documentclassOptions: ["11pt"],
    });
    expect(args.some((arg) => arg.includes("documentclass"))).toBe(true);
  });
});

describe("assertExportAllowed", () => {
  const cleanState = {
    orphanCrossRefs: [] as string[],
    missingCitations: [] as string[],
    hasUnapprovedUnits: false,
  };

  it("allows export when gates are off", () => {
    expect(() =>
      assertExportAllowed(
        {
          orphanCrossRefs: ["fig:missing"],
          missingCitations: ["smith2020"],
          hasUnapprovedUnits: true,
        },
        {},
      ),
    ).not.toThrow();
  });

  it("blocks orphan cross-references when enabled", () => {
    expect(() =>
      assertExportAllowed(
        { ...cleanState, orphanCrossRefs: ["fig:ghost", "tab:ghost"] },
        { blockOnOrphanRefs: true, blockOnUnapproved: false, blockOnMissingCitations: false },
      ),
    ).toThrow(ModelFsError);

    try {
      assertExportAllowed(
        { ...cleanState, orphanCrossRefs: ["fig:ghost"] },
        { blockOnOrphanRefs: true, blockOnUnapproved: false, blockOnMissingCitations: false },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ModelFsError);
      expect((error as ModelFsError).status).toBe(422);
      expect((error as ModelFsError).message).toContain("fig:ghost");
    }
  });

  it("blocks missing citations when enabled", () => {
    expect(() =>
      assertExportAllowed(
        { ...cleanState, missingCitations: ["doe2021"] },
        { blockOnOrphanRefs: false, blockOnUnapproved: false, blockOnMissingCitations: true },
      ),
    ).toThrow(ModelFsError);
  });

  it("blocks unapproved units when enabled", () => {
    expect(() =>
      assertExportAllowed(
        { ...cleanState, hasUnapprovedUnits: true },
        { blockOnOrphanRefs: false, blockOnUnapproved: true, blockOnMissingCitations: false },
      ),
    ).toThrow(ModelFsError);

    try {
      assertExportAllowed(
        { ...cleanState, hasUnapprovedUnits: true },
        { blockOnOrphanRefs: false, blockOnUnapproved: true, blockOnMissingCitations: false },
      );
    } catch (error) {
      expect((error as ModelFsError).status).toBe(422);
      expect((error as ModelFsError).message).toContain("unapproved");
    }
  });

  it("passes when enabled gates have no violations", () => {
    expect(() =>
      assertExportAllowed(cleanState, {
        blockOnOrphanRefs: true,
        blockOnUnapproved: true,
        blockOnMissingCitations: true,
      }),
    ).not.toThrow();
  });

  it("skips blockOnUnapproved when includeDrafts is true", () => {
    expect(() =>
      assertExportAllowed(
        { ...cleanState, hasUnapprovedUnits: true },
        { blockOnUnapproved: true, includeDrafts: true },
      ),
    ).not.toThrow();
  });

  it("still blocks unapproved when includeDrafts is false", () => {
    expect(() =>
      assertExportAllowed(
        { ...cleanState, hasUnapprovedUnits: true },
        { blockOnUnapproved: true, includeDrafts: false },
      ),
    ).toThrow(ModelFsError);
  });
});
