import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";

import { extractCiteKeys } from "../export.js";
import { parseEquationEmbeds, parseFigureEmbeds, parseWikilinks } from "../graph.js";
import { isUnitDir, ModelFsError, orderedChildren, readIndexData, resolveChildPath, resolveModelPath, toRelative } from "../modelFs.js";
import { buildManuscriptManifestBlock } from "../model/manuscriptKind.js";
import { paperLiteratureDir } from "../paperAssets.js";
import { gatherAutomaticContextPrefetch } from "./contextPrefetch.js";
import { actionNeedsDraft, type DispatchAction } from "./templates.js";

export interface ContextCandidate {
  path: string;
  label: string;
  category: "unit" | "link" | "literature" | "data" | "feedback";
  defaultIncluded: boolean;
}

const ASSET_FOLDER_PATTERN = /\/(figures|tables|equations)\/[^/]+$/;

export function paperRelFromUnitPath(unitPath: string): string | null {
  const match = unitPath.match(/^papers\/([^/]+)/);
  return match ? `papers/${match[1]}` : null;
}

async function readOutlineDoc(modelRoot: string, unitPath: string): Promise<string> {
  try {
    return (await readFile(path.join(modelRoot, unitPath, "outline.md"), "utf8")).trim();
  } catch {
    try {
      const raw = await readFile(path.join(modelRoot, unitPath, "INDEX.md"), "utf8");
      return matter(raw).content.trim();
    } catch {
      return "";
    }
  }
}

async function readIndexLinks(modelRoot: string, unitPath: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(modelRoot, unitPath, "INDEX.md"), "utf8");
    const parsed = matter(raw);
    return Array.isArray(parsed.data.links) ? (parsed.data.links as string[]) : [];
  } catch {
    return [];
  }
}

async function readContextSnippet(modelRoot: string, relPath: string): Promise<string> {
  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) return "";
  try {
    const raw = await readFile(abs, "utf8");
    const body = relPath.endsWith("INDEX.md") ? matter(raw).content : raw;
    return body.trim().slice(0, 1200);
  } catch {
    return "";
  }
}

async function gatherContext(modelRoot: string, links: string[]): Promise<string> {
  const parts: string[] = [];
  for (const link of links.slice(0, 5)) {
    try {
      let snippet = "";
      try {
        snippet = (await readFile(path.join(modelRoot, link, "outline.md"), "utf8")).trim().slice(0, 800);
      } catch {
        try {
          const raw = await readFile(path.join(modelRoot, link, "INDEX.md"), "utf8");
          snippet = matter(raw).content.trim().slice(0, 800);
        } catch {
          snippet = (await readFile(path.join(modelRoot, `${link}.md`), "utf8")).trim().slice(0, 800);
        }
      }
      if (snippet) parts.push(`[${link}]\n${snippet}`);
    } catch {
      // unresolved link — skip silently
    }
  }
  return parts.length > 0 ? `RELATED SECTIONS:\n${parts.join("\n\n")}` : "";
}

export function validateContextPaths(modelRoot: string, paths: string[]): string[] {
  return paths.map((relPath) => {
    const trimmed = relPath.trim();
    if (!trimmed) {
      throw new ModelFsError("Invalid context path", 400);
    }
    const abs = resolveModelPath(modelRoot, trimmed);
    return toRelative(modelRoot, abs);
  });
}

export async function gatherContextFromPaths(modelRoot: string, paths: string[]): Promise<string> {
  const safePaths = validateContextPaths(modelRoot, paths);
  const parts: string[] = [];
  for (const relPath of safePaths.slice(0, 12)) {
    const snippet = await readContextSnippet(modelRoot, relPath);
    if (snippet) parts.push(`[${relPath}]\n${snippet}`);
  }
  return parts.length > 0 ? `CONTEXT FILES:\n${parts.join("\n\n")}` : "";
}

async function listDataFigureContextFiles(
  modelRoot: string,
  paperRel: string,
  unitPath: string,
): Promise<ContextCandidate[]> {
  const notesDir = path.join(modelRoot, paperRel, "notes", "data");
  if (!existsSync(notesDir)) return [];
  const sectionSlug = path.posix.basename(path.posix.dirname(unitPath));
  const entries = await readdir(notesDir);
  const out: ContextCandidate[] = [];
  for (const name of entries.filter((entry) => entry.endsWith(".md") && entry !== "INDEX.md")) {
    const relPath = `${paperRel}/notes/data/${name}`;
    let defaultIncluded = false;
    try {
      const parsed = matter(await readFile(path.join(modelRoot, relPath), "utf8"));
      const data = parsed.data as Record<string, unknown>;
      if (data.kind === "figure") {
        const sections = Array.isArray(data.sections) ? (data.sections as string[]) : [];
        defaultIncluded = sections.some((section) => section === sectionSlug);
      }
    } catch {
      // skip unreadable notes
    }
    out.push({
      path: relPath,
      label: name.replace(/\.md$/, ""),
      category: "data",
      defaultIncluded,
    });
  }
  return out;
}

async function listNoteContextFiles(
  modelRoot: string,
  paperRel: string,
  subdir: string,
  category: ContextCandidate["category"],
  defaultIncluded: boolean,
): Promise<ContextCandidate[]> {
  const notesDir = path.join(modelRoot, paperRel, "notes", subdir);
  if (!existsSync(notesDir)) return [];
  const entries = await readdir(notesDir);
  return entries
    .filter((name) => name.endsWith(".md") && name !== "INDEX.md")
    .map((name) => ({
      path: `${paperRel}/notes/${subdir}/${name}`,
      label: name.replace(/\.md$/, ""),
      category,
      defaultIncluded,
    }));
}

function isPaperAssetFolderRel(relPath: string): boolean {
  return ASSET_FOLDER_PATTERN.test(relPath.replace(/\\/g, "/"));
}

function normalizeManuscriptTarget(target: string): string {
  return target
    .split("#")[0]
    ?.trim()
    .replace(/\\/g, "/")
    .replace(/\/?INDEX\.md$/, "")
    .replace(/\/outline\.md$/, "")
    .replace(/\/draft\.md$/, "") ?? "";
}

function resolveManuscriptTargetRel(
  modelRoot: string,
  paperRel: string,
  sourceDir: string,
  target: string,
): string | null {
  const clean = normalizeManuscriptTarget(target);
  if (!clean || clean.startsWith("http")) return null;

  const candidates = new Set<string>();
  candidates.add(clean);
  if (sourceDir) {
    candidates.add(`${sourceDir}/${clean}`);
    candidates.add(path.posix.normalize(`${sourceDir}/${clean}`));
  }
  if (paperRel) {
    candidates.add(`${paperRel}/${clean}`);
    candidates.add(path.posix.normalize(`${paperRel}/${clean}`));
  }

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, "/");
    const indexAbs = path.join(modelRoot, normalized, "INDEX.md");
    const dirAbs = path.join(modelRoot, normalized);
    if (existsSync(indexAbs) || existsSync(dirAbs)) {
      return normalized;
    }
  }
  return null;
}

async function listLiteratureNotePaths(modelRoot: string, paperRel: string): Promise<string[]> {
  const literatureDir = path.join(modelRoot, paperLiteratureDir(paperRel));
  if (!existsSync(literatureDir)) return [];
  const entries = await readdir(literatureDir);
  return entries
    .filter((name) => name.endsWith(".md") && name !== "INDEX.md" && name !== "outline.md" && name !== "draft.md")
    .map((name) => `${paperLiteratureDir(paperRel)}/${name}`)
    .sort();
}

async function readManuscriptFile(modelRoot: string, relPath: string): Promise<string> {
  try {
    return await readFile(path.join(modelRoot, relPath), "utf8");
  } catch {
    return "";
  }
}

async function collectCitedLiteratureNotePaths(
  modelRoot: string,
  paperRel: string,
  manuscriptPaths: string[],
): Promise<string[]> {
  let combined = "";
  for (const relPath of manuscriptPaths) {
    combined += `${await readManuscriptFile(modelRoot, relPath)}\n`;
  }
  const citeKeys = new Set(extractCiteKeys(combined));
  if (citeKeys.size === 0) return [];

  const matched: string[] = [];
  for (const relPath of await listLiteratureNotePaths(modelRoot, paperRel)) {
    const raw = await readManuscriptFile(modelRoot, relPath);
    if (!raw) continue;
    const parsed = matter(raw);
    const key = String(parsed.data.cite_key ?? path.posix.basename(relPath, ".md"));
    if (citeKeys.has(key)) matched.push(relPath);
  }
  return matched;
}

async function collectCitedAssetFolderPaths(
  modelRoot: string,
  paperRel: string,
  manuscriptPaths: string[],
): Promise<string[]> {
  const assetFolders = new Set<string>();
  for (const relPath of manuscriptPaths) {
    const raw = await readManuscriptFile(modelRoot, relPath);
    if (!raw) continue;
    const sourceDir = path.posix.dirname(relPath);
    const targets = [
      ...parseFigureEmbeds(raw),
      ...parseEquationEmbeds(raw),
      ...parseWikilinks(raw),
    ];
    for (const target of targets) {
      const resolved = resolveManuscriptTargetRel(modelRoot, paperRel, sourceDir, target);
      if (resolved && isPaperAssetFolderRel(resolved)) {
        assetFolders.add(resolved);
      }
    }
  }
  return [...assetFolders].sort();
}

function assetContextFilePaths(assetFolderRel: string): string[] {
  return [`${assetFolderRel}/outline.md`, `${assetFolderRel}/draft.md`];
}

/** Context files available for dispatch preview (checklist UI). */
export async function listContextCandidates(
  modelRoot: string,
  unitPath: string,
  action: DispatchAction,
): Promise<ContextCandidate[]> {
  const candidates: ContextCandidate[] = [
    {
      path: `${unitPath}/outline.md`,
      label: "Unit outline",
      category: "unit",
      defaultIncluded: true,
    },
  ];
  if (actionNeedsDraft(action)) {
    candidates.push({
      path: `${unitPath}/draft.md`,
      label: "Current draft",
      category: "unit",
      defaultIncluded: true,
    });
  }

  const links = await readIndexLinks(modelRoot, unitPath);
  for (const link of links.slice(0, 8)) {
    const rel = link.endsWith(".md") ? link : `${link}/outline.md`;
    candidates.push({
      path: rel,
      label: link,
      category: "link",
      defaultIncluded: true,
    });
  }

  const paperRel = paperRelFromUnitPath(unitPath);
  if (paperRel && action !== "summarize-outline") {
    const unitManuscript = [`${unitPath}/outline.md`, `${unitPath}/draft.md`];
    for (const relPath of await collectCitedLiteratureNotePaths(modelRoot, paperRel, unitManuscript)) {
      candidates.push({
        path: relPath,
        label: relPath.split("/").pop()?.replace(/\.md$/, "") ?? relPath,
        category: "literature",
        defaultIncluded: true,
      });
    }
    candidates.push(
      ...(await listDataFigureContextFiles(modelRoot, paperRel, unitPath)),
      ...(await listNoteContextFiles(modelRoot, paperRel, "feedback", "feedback", false)),
    );
  }

  if (action === "summarize-outline") {
    for (const entry of await listSummarizeOutlineContextPaths(modelRoot, unitPath)) {
      candidates.push({
        path: entry.path,
        label: entry.label,
        category: entry.category,
        defaultIncluded: true,
      });
    }
  }

  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

export async function collectUnitPaths(modelRoot: string, rootRel: string): Promise<string[]> {
  if (await isUnitDir(modelRoot, rootRel)) return [rootRel];
  const units: string[] = [];
  for (const child of await orderedChildren(modelRoot, rootRel)) {
    const childRel = resolveChildPath(modelRoot, rootRel, child);
    if (!childRel) continue;
    units.push(...(await collectUnitPaths(modelRoot, childRel)));
  }
  return units;
}

/** Outline and draft paths for every descendant unit/subsection under a section. */
export async function collectDescendantManuscriptPaths(
  modelRoot: string,
  rootRel: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (const child of await orderedChildren(modelRoot, rootRel)) {
    const childRel = resolveChildPath(modelRoot, rootRel, child);
    if (!childRel) continue;
    paths.push(`${childRel}/outline.md`);
    if (await isUnitDir(modelRoot, childRel)) {
      paths.push(`${childRel}/draft.md`);
      continue;
    }
    paths.push(...(await collectDescendantManuscriptPaths(modelRoot, childRel)));
  }
  return paths;
}

/** Context file paths for summarize-outline: downstream prose, cited references, cited assets only. */
export async function listSummarizeOutlineContextPaths(
  modelRoot: string,
  sectionPath: string,
): Promise<{ path: string; category: ContextCandidate["category"]; label: string }[]> {
  const paperRel = paperRelFromUnitPath(sectionPath);
  const manuscriptPaths = await collectDescendantManuscriptPaths(modelRoot, sectionPath);
  const out: { path: string; category: ContextCandidate["category"]; label: string }[] = [];

  for (const relPath of manuscriptPaths) {
    out.push({
      path: relPath,
      label: relPath.replace(/\/(outline|draft)\.md$/, ""),
      category: relPath.endsWith("/draft.md") ? "unit" : "link",
    });
  }

  if (paperRel) {
    for (const relPath of await collectCitedLiteratureNotePaths(modelRoot, paperRel, manuscriptPaths)) {
      out.push({
        path: relPath,
        label: relPath.split("/").pop()?.replace(/\.md$/, "") ?? relPath,
        category: "literature",
      });
    }

    const citedAssets = await collectCitedAssetFolderPaths(modelRoot, paperRel, manuscriptPaths);
    for (const assetFolder of citedAssets) {
      for (const relPath of assetContextFilePaths(assetFolder)) {
        out.push({
          path: relPath,
          label: assetFolder.split("/").pop() ?? assetFolder,
          category: "data",
        });
      }
    }
  }

  const seen = new Set<string>();
  return out.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

export async function gatherSummarizeOutlineContext(
  modelRoot: string,
  sectionPath: string,
  contextPaths?: string[],
): Promise<string> {
  const entries =
    contextPaths && contextPaths.length > 0
      ? validateContextPaths(modelRoot, contextPaths).map((pathValue) => ({
          path: pathValue,
          category:
            pathValue.includes("/notes/literature/")
              ? ("literature" as const)
              : pathValue.includes("/figures/") ||
                  pathValue.includes("/tables/") ||
                  pathValue.includes("/equations/")
                ? ("data" as const)
                : pathValue.endsWith("/draft.md")
                  ? ("unit" as const)
                  : ("link" as const),
        }))
      : (await listSummarizeOutlineContextPaths(modelRoot, sectionPath)).map((entry) => ({
          path: entry.path,
          category: entry.category,
        }));

  const sections: { heading: string; paths: string[] }[] = [
    { heading: "DOWNSTREAM PARTS", paths: [] },
    { heading: "REFERENCES", paths: [] },
    { heading: "CITED ASSETS", paths: [] },
  ];

  for (const entry of entries) {
    if (entry.category === "literature") {
      sections[1].paths.push(entry.path);
    } else if (entry.category === "data") {
      sections[2].paths.push(entry.path);
    } else {
      sections[0].paths.push(entry.path);
    }
  }

  const blocks: string[] = [];
  for (const section of sections) {
    if (section.paths.length === 0) continue;
    const parts: string[] = [];
    for (const relPath of section.paths) {
      const snippet = await readContextSnippet(modelRoot, relPath);
      if (snippet) parts.push(`[${relPath}]\n${snippet}`);
    }
    if (parts.length > 0) {
      blocks.push(`${section.heading}:\n${parts.join("\n\n")}`);
    }
  }

  return blocks.join("\n\n");
}

/** Read outline + index links for prompt assembly. */
export async function readDispatchUnitContext(
  modelRoot: string,
  unitPath: string,
  action: DispatchAction,
  contextPaths?: string[],
): Promise<{ idea: string; links: string[]; context: string }> {
  const idea = await readOutlineDoc(modelRoot, unitPath);
  const links = await readIndexLinks(modelRoot, unitPath);
  let context: string;
  if (contextPaths && contextPaths.length > 0) {
    context = await gatherContextFromPaths(modelRoot, contextPaths);
  } else if (action === "summarize-outline") {
    context = await gatherSummarizeOutlineContext(modelRoot, unitPath, contextPaths);
  } else {
    context = await gatherContext(modelRoot, links);
  }

  const prefetch = await gatherAutomaticContextPrefetch(
    modelRoot,
    unitPath,
    action,
    idea,
    contextPaths,
  );
  if (prefetch) {
    context = context ? `${context}\n\n${prefetch}` : prefetch;
  }

  const paperRel = paperRelFromUnitPath(unitPath);
  if (paperRel) {
    try {
      const indexData = await readIndexData(modelRoot, paperRel);
      const manifest = buildManuscriptManifestBlock(indexData);
      if (manifest) {
        context = context
          ? `[Manuscript manifest]\n${manifest}\n\n${context}`
          : `[Manuscript manifest]\n${manifest}`;
      }
    } catch {
      // ignore missing manifest
    }
  }

  return { idea, links, context };
}

export async function readDraftForDispatch(modelRoot: string, unitPath: string): Promise<string> {
  try {
    return await readFile(path.join(modelRoot, unitPath, "draft.md"), "utf8");
  } catch {
    return "";
  }
}
