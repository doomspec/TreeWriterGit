import JSZip from "jszip";

import type { DocxHeadingComment } from "./exportDocxStructure.js";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const COMMENTS_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

const HEADING_STYLE_RE = /^Heading[1-6]$|^MdHeading[1-6]$/;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHeading(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function paragraphText(paragraphXml: string): string {
  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(paragraphXml)) !== null) {
    texts.push(match[1]!.replace(/<\/w:t><w:t(?:\s[^>]*)?>/g, ""));
  }
  return texts
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphStyleId(paragraphXml: string): string | null {
  const match = /<w:pStyle w:val="([^"]+)"/.exec(paragraphXml);
  return match?.[1] ?? null;
}

function buildCommentParagraphs(comment: string): string {
  const lines = comment.split(/\n/);
  return lines
    .map((line) => {
      const escaped = escapeXml(line);
      const preserve = line.startsWith(" ") || line.endsWith(" ") ? ' xml:space="preserve"' : "";
      return `<w:p><w:r><w:t${preserve}>${escaped}</w:t></w:r></w:p>`;
    })
    .join("");
}

function buildCommentsXml(comments: DocxHeadingComment[]): string {
  const body = comments
    .map(
      (entry, index) =>
        `<w:comment w:id="${index}" w:author="TreeWriter" w:initials="TW" w:date="2026-01-01T00:00:00Z">${buildCommentParagraphs(entry.comment)}</w:comment>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W_NS}">${body}</w:comments>`;
}

function injectCommentIntoParagraph(paragraphXml: string, commentId: number): string {
  const markerStart = `<w:commentRangeStart w:id="${commentId}"/>`;
  const markerEnd = `<w:commentRangeEnd w:id="${commentId}"/>`;
  const markerRef = `<w:r><w:commentReference w:id="${commentId}"/></w:r>`;

  if (paragraphXml.includes(markerStart)) return paragraphXml;

  const pPrMatch = /<w:pPr[\s\S]*?<\/w:pPr>/.exec(paragraphXml);
  if (pPrMatch) {
    const insertAt = pPrMatch.index + pPrMatch[0].length;
    return (
      paragraphXml.slice(0, insertAt) +
      markerStart +
      paragraphXml.slice(insertAt).replace(/<\/w:p>\s*$/, `${markerRef}${markerEnd}</w:p>`)
    );
  }

  return paragraphXml.replace(
    /^(\s*<w:p\b[^>]*>)/,
    `$1${markerStart}`,
  ).replace(/<\/w:p>\s*$/, `${markerRef}${markerEnd}</w:p>`);
}

function nextRelationshipId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/\bId="rId(\d+)"/g)].map((match) => Number(match[1]));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `rId${next}`;
}

/** Attach TreeWriter outline text as Word comments on matching heading paragraphs. */
export async function applyDocxOutlineComments(
  docxBuffer: Buffer,
  comments: DocxHeadingComment[],
): Promise<Buffer> {
  if (comments.length === 0) return docxBuffer;

  const zip = await JSZip.loadAsync(docxBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return docxBuffer;

  const commentByHeading = new Map<string, number>();
  comments.forEach((entry, index) => {
    commentByHeading.set(normalizeHeading(entry.heading), index);
  });

  let documentXml = await documentFile.async("string");
  const usedCommentIds = new Set<number>();

  documentXml = documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const styleId = paragraphStyleId(paragraphXml);
    if (!styleId || !HEADING_STYLE_RE.test(styleId)) return paragraphXml;

    const text = paragraphText(paragraphXml);
    const commentId = commentByHeading.get(normalizeHeading(text));
    if (commentId === undefined) return paragraphXml;

    usedCommentIds.add(commentId);
    return injectCommentIntoParagraph(paragraphXml, commentId);
  });

  if (usedCommentIds.size === 0) return docxBuffer;

  zip.file("word/comments.xml", buildCommentsXml(comments));

  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    let relsXml = await relsFile.async("string");
    if (!relsXml.includes("comments.xml")) {
      const relId = nextRelationshipId(relsXml);
      relsXml = relsXml.replace(
        "</Relationships>",
        `<Relationship Id="${relId}" Type="${COMMENTS_REL_TYPE}" Target="comments.xml"/></Relationships>`,
      );
      zip.file("word/_rels/document.xml.rels", relsXml);
    }
  }

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    let contentTypesXml = await contentTypesFile.async("string");
    if (!contentTypesXml.includes("/word/comments.xml")) {
      contentTypesXml = contentTypesXml.replace(
        "</Types>",
        `<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>`,
      );
      zip.file("[Content_Types].xml", contentTypesXml);
    }
  }

  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "nodebuffer" });
}
