import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import matter from "gray-matter";

import { parseOutlineSummary } from "./compose.js";
import {
  isTableDir,
  isUnitDir,
  orderedChildren,
  readIndexData,
  resolveChildPath,
} from "./modelFs.js";

export type TableMetadata = {
  kind: "table-unit" | "table-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  tableLabel: string | null;
};

function stripLeadingH1(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "")
    .trim();
}

async function readTableUnitMetadata(
  modelRoot: string,
  dirRel: string,
): Promise<TableMetadata | null> {
  if (!(await isTableDir(modelRoot, dirRel))) return null;

  const data = await readIndexData(modelRoot, dirRel);
  const title = String(data.title ?? path.posix.basename(dirRel));

  let caption = "";
  const draftPath = path.posix.join(dirRel, "draft.md");
  if (existsSync(path.join(modelRoot, draftPath))) {
    caption = stripLeadingH1(await readFile(path.join(modelRoot, draftPath), "utf8"));
  }

  const outlinePath = path.posix.join(dirRel, "outline.md");
  let summary: string | null = null;
  if (existsSync(path.join(modelRoot, outlinePath))) {
    summary = parseOutlineSummary(await readFile(path.join(modelRoot, outlinePath), "utf8"));
  }

  return {
    kind: "table-unit",
    path: dirRel,
    title,
    caption,
    summary,
    outlinePath,
    draftPath,
    tableLabel: data.table_label ? String(data.table_label) : null,
  };
}

async function readTableNoteMetadata(
  modelRoot: string,
  noteRel: string,
): Promise<TableMetadata | null> {
  const abs = path.join(modelRoot, noteRel);
  if (!existsSync(abs)) return null;
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "table") return null;

  const title = String(data.title ?? path.posix.basename(noteRel, ".md"));
  const caption = String(data.caption ?? "").trim();
  const summary = parseOutlineSummary(raw) ?? (parsed.content.trim() || null);

  return {
    kind: "table-note",
    path: noteRel.replace(/\.md$/, ""),
    title,
    caption,
    summary,
    outlinePath: noteRel,
    draftPath: null,
    tableLabel: data.table_label ? String(data.table_label) : null,
  };
}

export function paperTablesDir(paperRel: string): string {
  return path.posix.join(paperRel, "tables");
}

/** List table targets under a paper (tables/ folder, inline units, notes/data). */
export async function listPaperTables(
  modelRoot: string,
  paperRel: string,
): Promise<TableMetadata[]> {
  const tables: TableMetadata[] = [];
  const seen = new Set<string>();

  const tablesRoot = paperTablesDir(paperRel);
  if (existsSync(path.join(modelRoot, tablesRoot))) {
    for (const child of await orderedChildren(modelRoot, tablesRoot)) {
      const childRel = resolveChildPath(modelRoot, tablesRoot, child);
      if (!childRel) continue;
      const meta = await readTableUnitMetadata(modelRoot, childRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        tables.push(meta);
      }
    }
  }

  async function walk(dirRel: string): Promise<void> {
    if (dirRel === tablesRoot || dirRel.startsWith(`${tablesRoot}/`)) return;
    if (dirRel.includes("/notes/") && !dirRel.includes("/notes/data")) return;

    if (await isTableDir(modelRoot, dirRel)) {
      const meta = await readTableUnitMetadata(modelRoot, dirRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        tables.push(meta);
      }
      return;
    }

    if (!(await isUnitDir(modelRoot, dirRel))) {
      for (const child of await orderedChildren(modelRoot, dirRel)) {
        const childRel = resolveChildPath(modelRoot, dirRel, child);
        if (childRel) await walk(childRel);
      }
    }
  }

  await walk(paperRel);

  const dataNotesDir = path.posix.join(paperRel, "notes/data");
  if (existsSync(path.join(modelRoot, dataNotesDir))) {
    const entries = await readdir(path.join(modelRoot, dataNotesDir));
    for (const file of entries.filter((name) => name.endsWith(".md") && name !== "INDEX.md")) {
      const noteRel = path.posix.join(dataNotesDir, file);
      const meta = await readTableNoteMetadata(modelRoot, noteRel);
      if (meta && !seen.has(meta.path)) {
        seen.add(meta.path);
        tables.push(meta);
      }
    }
  }

  return tables;
}
