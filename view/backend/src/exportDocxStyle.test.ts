import { describe, expect, it } from "vitest";
import markdownDocx, { Packer } from "markdown-docx";
import JSZip from "jszip";

import {
  applyArialDocxFonts,
  buildMarkdownDocxExportOptions,
  postProcessDocxExport,
  SCIENTIFIC_DATA_DOCX_THEME,
  stripMdSpaceParagraphs,
} from "./exportDocxStyle.js";

describe("SCIENTIFIC_DATA_DOCX_THEME", () => {
  it("matches the Scientific Data descriptor template heading sizes", () => {
    expect(SCIENTIFIC_DATA_DOCX_THEME.bodySize).toBe(11);
    expect(SCIENTIFIC_DATA_DOCX_THEME.heading1Size).toBe(16);
    expect(SCIENTIFIC_DATA_DOCX_THEME.heading2Size).toBe(14);
    expect(SCIENTIFIC_DATA_DOCX_THEME.heading3Size).toBe(13);
  });
});

describe("applyArialDocxFonts", () => {
  it("sets Arial on document defaults while keeping code blocks monospace", async () => {
    const doc = await markdownDocx(
      "# Title\n\nBody text.\n\n```\ncode block\n```",
      buildMarkdownDocxExportOptions(async () => null),
    );
    const raw = await Packer.toBuffer(doc);
    const patched = await applyArialDocxFonts(Buffer.from(raw));

    const zip = await JSZip.loadAsync(patched);
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:ascii="Arial"');
    expect(styles).toMatch(/<w:docDefaults>[\s\S]*w:ascii="Arial"/);
    expect(styles).toContain('w:styleId="MdCode"');
    expect(styles).toMatch(/w:styleId="MdCode"[\s\S]*w:ascii="Courier New"/);
  });
});

describe("stripMdSpaceParagraphs", () => {
  it("removes empty MdSpace paragraphs from markdown-docx output", async () => {
    const doc = await markdownDocx(
      "First paragraph.\n\nSecond paragraph.",
      buildMarkdownDocxExportOptions(async () => null),
    );
    const raw = await Packer.toBuffer(doc);
    const patched = await stripMdSpaceParagraphs(Buffer.from(raw));

    const zip = await JSZip.loadAsync(patched);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(documentXml).not.toContain('w:val="MdSpace"');
    expect(documentXml).toContain("First paragraph.");
    expect(documentXml).toContain("Second paragraph.");
  });
});

describe("postProcessDocxExport", () => {
  it("applies Arial fonts and strips MdSpace paragraphs", async () => {
    const doc = await markdownDocx(
      "# Title\n\nBody one.\n\nBody two.",
      buildMarkdownDocxExportOptions(async () => null),
    );
    const raw = await Packer.toBuffer(doc);
    const patched = await postProcessDocxExport(Buffer.from(raw));

    const zip = await JSZip.loadAsync(patched);
    const styles = await zip.file("word/styles.xml")!.async("string");
    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(styles).toContain('w:ascii="Arial"');
    expect(documentXml).not.toContain('w:val="MdSpace"');
  });
});
