import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { parseOutlineSummary } from "./compose.js";
import {
  isEquationDir,
  isFigureDir,
  isTableDir,
  isUnitDir,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "./modelFs.js";

export type DocxHeadingComment = {
  heading: string;
  comment: string;
};

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function shouldEmitSectionHeading(data: Record<string, unknown>): boolean {
  const kind = String(data.kind ?? "").toLowerCase();
  if (kind === "unit" || kind === "figure" || kind === "table" || kind === "equation") {
    return false;
  }
  return kind === "section" || kind === "subsection" || kind === "paper" || kind === "";
}

/** Plain-text outline for a Word comment on a heading. */
export function formatOutlineForDocxComment(outlineMarkdown: string): string {
  const summary = parseOutlineSummary(outlineMarkdown);
  let body = summary ?? outlineMarkdown;
  body = body
    .replace(/^---[\s\S]*?---\n?/, "")
    .replace(/^\s*#(?!#)\s+[^\n]+\n?/, "")
    .replace(/##\s+Outline[\s\S]*$/i, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[@([^\]]+)\]/g, (_full, cites: string) =>
      cites
        .split(/[,;]/)
        .map((part: string) => part.trim().replace(/^@/, ""))
        .filter(Boolean)
        .join(", "),
    )
    .replace(/\\hl\{[a-z]+\}\{([^}]*)\}/g, "$1")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\([a-zA-Z]+)\{([^}]*)\}/g, "$2")
    .replace(/\$\s?([^$]+?)\s?\$/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body.slice(0, 8000);
}

async function readOutlineMarkdown(modelRoot: string, dirRel: string): Promise<string | null> {
  const outlineAbs = path.join(modelRoot, dirRel, "outline.md");
  if (!existsSync(outlineAbs)) return null;
  const raw = (await readFile(outlineAbs, "utf8")).trim();
  return raw || null;
}

/** Collect section/subsection/paper outline text keyed by exported heading labels. */
export async function collectDocxOutlineComments(
  modelRoot: string,
  paperRel: string,
): Promise<DocxHeadingComment[]> {
  const comments: DocxHeadingComment[] = [];
  const seen = new Set<string>();

  const push = (heading: string, comment: string) => {
    const key = heading.replace(/\s+/g, " ").trim().toLowerCase();
    const text = comment.trim();
    if (!text || seen.has(key)) return;
    seen.add(key);
    comments.push({ heading: heading.replace(/\s+/g, " ").trim(), comment: text });
  };

  const paperData = await readIndexData(modelRoot, paperRel);
  const paperTitle = String(paperData.title ?? path.posix.basename(paperRel));
  const paperOutline = await readOutlineMarkdown(modelRoot, paperRel);
  if (paperOutline) {
    push(paperTitle, formatOutlineForDocxComment(paperOutline));
  }

  async function walk(dirRel: string, depth: number): Promise<void> {
    if (dirRel.includes("/notes/") || dirRel.endsWith("/notes")) return;

    if (await isFigureDir(modelRoot, dirRel)) return;
    if (await isEquationDir(modelRoot, dirRel)) return;
    if (await isTableDir(modelRoot, dirRel)) return;

    if (await isUnitDir(modelRoot, dirRel)) {
      const data = await readIndexData(modelRoot, dirRel);
      const base = path.posix.basename(dirRel).toLowerCase();
      const unitTitle = String(data.title ?? base);
      if (base === "abstract" || unitTitle.toLowerCase() === "abstract") {
        const outline = await readOutlineMarkdown(modelRoot, dirRel);
        if (outline) push("Abstract", formatOutlineForDocxComment(outline));
      }
      return;
    }

    const data = await readIndexData(modelRoot, dirRel);
    const title = String(data.title ?? path.posix.basename(dirRel));
    const isSectionsContainer = path.posix.basename(dirRel) === "sections";

    let childCount = 0;
    for (const child of await orderedChildren(modelRoot, dirRel)) {
      const childRel = resolveChildPath(modelRoot, dirRel, child);
      if (!childRel) continue;
      childCount += 1;
      await walk(childRel, depth + 1);
    }

    if (depth > 0 && !isSectionsContainer && shouldEmitSectionHeading(data)) {
      const outline = await readOutlineMarkdown(modelRoot, dirRel);
      if (outline) push(titleCase(title), formatOutlineForDocxComment(outline));
    }

    if (childCount === 0) return;
  }

  await walk(paperRel, 0);
  return comments;
}

/** Insert a labeled Abstract heading before the first top-level section body. */
export function insertDocxAbstractHeading(markdown: string): string {
  if (/^##\s+Abstract\s*$/im.test(markdown)) return markdown;

  const match = markdown.match(/^(#\s[^\n]+\n\n)([\s\S]*?)(\n##\s+[^\n]+\n\n)([\s\S]*)$/);
  if (!match) return markdown;

  const leadIn = match[2]?.trim() ?? "";
  if (!leadIn) return markdown;

  return `${match[1]}## Abstract\n\n${match[2]}${match[3]}${match[4] ?? ""}`;
}
