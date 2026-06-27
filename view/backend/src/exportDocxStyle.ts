import JSZip from "jszip";

import type { MarkdownDocxOptions, MarkdownImageAdapter } from "markdown-docx";

import { applyDocxOutlineComments } from "./exportDocxComments.js";
import type { DocxHeadingComment } from "./exportDocxStructure.js";

/** Typography aligned with scidata-data-descriptor-document-template.docx (Arial headings, 11pt body). */
export const SCIENTIFIC_DATA_DOCX_THEME = {
  bodySize: 11,
  heading1Size: 16,
  heading2Size: 14,
  heading3Size: 13,
  heading4Size: 12,
  heading5Size: 11,
  heading6Size: 11,
  codeSize: 10,
  lineSpacing: 1,
  heading1: "000000",
  heading2: "000000",
  heading3: "000000",
  heading4: "000000",
  heading5: "000000",
  heading6: "000000",
  link: "0563C1",
  linkUnderline: true,
} as const;

const ARIAL_R_FONTS =
  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>';

const MONOSPACE_STYLE_IDS = new Set(["MdCode", "MdHtml"]);

export function buildMarkdownDocxExportOptions(
  imageAdapter: MarkdownImageAdapter,
): MarkdownDocxOptions {
  return {
    gfm: true,
    breaks: false,
    theme: { ...SCIENTIFIC_DATA_DOCX_THEME },
    imageAdapter,
    math: { engine: "katex", libreOfficeCompat: true },
  };
}

function injectArialIntoRPr(rPrInner: string): string {
  if (rPrInner.includes("w:rFonts")) {
    return rPrInner.replace(/<w:rFonts[^/]*\/>/g, ARIAL_R_FONTS);
  }
  return `${ARIAL_R_FONTS}${rPrInner}`;
}

const MD_SPACE_PARAGRAPH_RE =
  /<w:p\b[^>]*>(?:(?!<\/w:p>).)*?<w:pStyle w:val="MdSpace"\s*\/>(?:(?!<\/w:p>).)*?<\/w:p>/gs;

/** Remove markdown-docx spacer paragraphs; MdParagraph/headings already carry spacing. */
export async function stripMdSpaceParagraphs(docxBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return docxBuffer;

  const xml = (await documentFile.async("string")).replace(MD_SPACE_PARAGRAPH_RE, "");
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Patch generated DOCX styles so body/headings use Arial (keeps Courier New for code blocks). */
export async function applyArialDocxFonts(docxBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const stylesFile = zip.file("word/styles.xml");
  if (!stylesFile) return docxBuffer;

  let xml = await stylesFile.async("string");

  xml = xml.replace(
    /(<w:docDefaults><w:rPrDefault><w:rPr>)/,
    `$1${ARIAL_R_FONTS}`,
  );

  xml = xml.replace(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g, (full, attrs, body) => {
    const styleIdMatch = /w:styleId="([^"]+)"/.exec(String(attrs));
    const styleId = styleIdMatch?.[1] ?? "";
    if (MONOSPACE_STYLE_IDS.has(styleId)) return full;

    let nextBody = String(body);
    if (nextBody.includes("<w:rPr>")) {
      nextBody = nextBody.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (_m, inner) => {
        return `<w:rPr>${injectArialIntoRPr(String(inner))}</w:rPr>`;
      });
    }
    return `<w:style${attrs}>${nextBody}</w:style>`;
  });

  zip.file("word/styles.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Font theming, spacer cleanup, and outline comments for TreeWriter DOCX exports. */
export async function postProcessDocxExport(
  docxBuffer: Buffer,
  outlineComments: DocxHeadingComment[] = [],
): Promise<Buffer> {
  let buffer = await applyArialDocxFonts(docxBuffer);
  buffer = await stripMdSpaceParagraphs(buffer);
  if (outlineComments.length > 0) {
    buffer = await applyDocxOutlineComments(buffer, outlineComments);
  }
  return buffer;
}
