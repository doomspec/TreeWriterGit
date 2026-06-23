import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

import { extractCiteKeys } from "./export.js";
import { parseEquationEmbeds, parseFigureEmbeds, parseWikilinks } from "./graph.js";
import { isUnitDir, orderedChildren, readIndexData, resolveChildPath, shellQuote } from "./modelFs.js";
import { stripInlineNotes } from "./inlineNotes.js";
import { MANUSCRIPT_MARKUP, shouldIncludeManuscriptMarkup } from "./manuscriptMarkup.js";
import { paperLiteratureDir } from "./paperAssets.js";

const execFileAsync = promisify(execFile);
const DISPATCH_RUN_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "dispatch_run.py",
);

export interface AiProvider {
  name: string;
  command: string;
  args: string[];
  writesFiles: boolean;
}

export interface ProviderConfig {
  aiProviders: AiProvider[];
  defaultProvider: string;
}

const DEFAULT_PROVIDERS: AiProvider[] = [
  { name: "Claude Code", command: "claude", args: ["-p", "{prompt}"], writesFiles: true },
  { name: "Aider", command: "aider", args: ["--message", "{prompt}", "{files}"], writesFiles: true },
  {
    name: "Gemini",
    command: "gemini",
    args: ["-p", "{prompt}", "--approval-mode", "auto_edit"],
    writesFiles: true,
  },
];

/** CLIs that refuse to run when stdout is redirected (e.g. codex interactive mode). */
const TTY_STDOUT_COMMANDS = new Set(["codex"]);

export async function loadProviders(repoRoot: string): Promise<ProviderConfig> {
  const configPath = path.join(repoRoot, ".treewriter.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
    const providers = Array.isArray(parsed.aiProviders) && parsed.aiProviders.length > 0
      ? parsed.aiProviders
      : DEFAULT_PROVIDERS;
    return {
      aiProviders: providers,
      defaultProvider: parsed.defaultProvider ?? providers[0].name,
    };
  } catch {
    return { aiProviders: DEFAULT_PROVIDERS, defaultProvider: DEFAULT_PROVIDERS[0].name };
  }
}

export async function saveDefaultProvider(
  repoRoot: string,
  defaultProvider: string,
): Promise<ProviderConfig> {
  const name = defaultProvider.trim();
  if (!name) {
    throw new Error("defaultProvider is required");
  }
  const configPath = path.join(repoRoot, ".treewriter.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  const current = await loadProviders(repoRoot);
  if (!current.aiProviders.some((provider) => provider.name === name)) {
    throw new Error(`Unknown provider: ${name}`);
  }
  parsed.defaultProvider = name;
  if (!Array.isArray(parsed.aiProviders) || parsed.aiProviders.length === 0) {
    parsed.aiProviders = current.aiProviders;
  }
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return loadProviders(repoRoot);
}

export type DispatchAction =
  | "draft"
  | "revise"
  | "expand"
  | "cite-check"
  | "custom"
  | "refresh-index"
  | "sync-outline"
  | "summarize-outline"
  | "generate-figure";

// Template variables: {idea}, {draft}, {context}, {outputPath}, {outlinePath}, {customPrompt}
const TEMPLATES: Record<DispatchAction, string> = {
  draft: `Write a complete, publication-quality paragraph for the following section of a scientific paper.

SECTION OVERVIEW (outline.md):
{idea}

{context}

Write the manuscript paragraph directly to file {outputPath}. Overwrite any existing content. Use formal academic language. No preamble or meta-commentary — output only the paragraph text that will appear in the final manuscript.`,

  revise: `Revise the following draft paragraph for clarity, precision, and scientific rigor.

SECTION OVERVIEW (what this paragraph must convey):
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the revised paragraph directly to file {outputPath}. Preserve all factual claims and citations.`,

  expand: `Expand the following paragraph with additional detail, supporting evidence, and improved transitions.

SECTION OVERVIEW:
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the expanded version directly to file {outputPath}.`,

  "cite-check": `Review the following paragraph and identify any claims that need citations. Add citation placeholders in the form [@cite_key].

CURRENT DRAFT:
{draft}

{context}

Write the annotated paragraph directly to file {outputPath}.`,

  custom: `{customPrompt}

Target file: {outputPath}`,

  "refresh-index": `Regenerate the user-facing section overview (outline.md) from its child folders and files.

CURRENT OVERVIEW:
{idea}

{context}

Write an updated outline.md to {outlinePath}. Include ## Summary and ## Outline sections with markdown links to children. Do not write to INDEX.md — that file holds technical metadata only.`,

  "sync-outline": `Update the section overview (outline.md) from the current manuscript draft (bottom-up sync).

CURRENT OVERVIEW:
{idea}

CURRENT DRAFT (manuscript text):
{draft}

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line.
- For unit nodes: use \`Overview:\` followed by a concise bullet list (4–6 bullets max, one line each).
- Each bullet states one claim or idea in ≤20 words; attach relevant \`[@citation_key]\` when the draft cites sources.
- Do not write narrative paragraphs, meta-commentary ("This paragraph defines…"), or long prose summaries.
- Preserve citation keys exactly as \`[@key]\` or \`[@a; @b]\` — do not invent keys.
- For container sections (not a single paragraph unit): use \`## Summary\` and optional \`## Outline\` with markdown links to children.

The overview guides future draft revisions — be brief and scannable.`,

  "summarize-outline": `Update this section's overview (outline.md) by synthesizing all downstream child content.

CURRENT SECTION OVERVIEW:
{idea}

DOWNSTREAM PARTS (direct children, nested subsections, and units):
{context}

The context may also include:
- \`REFERENCES:\` — literature notes for \`[@cite_key]\` tokens used in downstream text (not the full bibliography)
- \`CITED ASSETS:\` — only figures, tables, and equations referenced in downstream text (do not infer uncited assets)

Write an updated outline.md to {outlinePath}.

FORMAT (strict):
- Keep \`# Title\` as the first line (the section title).
- Add \`## Summary\` with 4–8 concise bullets that synthesize themes from all downstream outlines and drafts.
- Each bullet is one line, ≤25 words; preserve \`[@citation_key]\` when sources appear downstream.
- Add \`## Outline\` listing every direct child as a markdown link, e.g. \`- [Background](background/INDEX.md)\`.
- Do not paste full child outlines — synthesize at this section level only.
- Do not write narrative paragraphs or meta-commentary.
- Do not write to INDEX.md — that file holds technical metadata only.`,

  "generate-figure": `Generate or update a scientific figure as Mermaid source for this figure unit.

FIGURE BRIEF (outline.md):
{idea}

CURRENT CAPTION (draft.md):
{draft}

{context}

Write Mermaid diagram source to {figureSourcePath}. Use clear node labels suitable for a publication figure. Prefer flowchart TD or LR unless another diagram type fits better. Optionally update the caption in {captionPath} if needed.`,
};

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

async function readDraft(modelRoot: string, unitPath: string): Promise<string> {
  try {
    return await readFile(path.join(modelRoot, unitPath, "draft.md"), "utf8");
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
        snippet = (await readFile(path.join(modelRoot, link, "outline.md"), "utf8")).trim().slice(0, 500);
      } catch {
        try {
          const raw = await readFile(path.join(modelRoot, link, "INDEX.md"), "utf8");
          snippet = matter(raw).content.trim().slice(0, 500);
        } catch {
          snippet = (await readFile(path.join(modelRoot, `${link}.md`), "utf8")).trim().slice(0, 500);
        }
      }
      if (snippet) parts.push(`[${link}]\n${snippet}`);
    } catch {
      // unresolved link — skip silently
    }
  }
  return parts.length > 0 ? `RELATED SECTIONS:\n${parts.join("\n\n")}` : "";
}

export interface ContextCandidate {
  path: string;
  label: string;
  category: "unit" | "link" | "literature" | "data" | "feedback";
  defaultIncluded: boolean;
}

function paperRelFromUnitPath(unitPath: string): string | null {
  const match = unitPath.match(/^papers\/([^/]+)/);
  return match ? `papers/${match[1]}` : null;
}

function actionNeedsDraft(action: DispatchAction): boolean {
  return (
    action !== "draft" &&
    action !== "custom" &&
    action !== "refresh-index" &&
    action !== "summarize-outline" &&
    action !== "generate-figure"
  );
}

async function readContextSnippet(modelRoot: string, relPath: string): Promise<string> {
  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) return "";
  try {
    const raw = await readFile(abs, "utf8");
    const body = relPath.endsWith("INDEX.md") ? matter(raw).content : raw;
    return body.trim().slice(0, 800);
  } catch {
    return "";
  }
}

async function gatherContextFromPaths(modelRoot: string, paths: string[]): Promise<string> {
  const parts: string[] = [];
  for (const relPath of paths.slice(0, 12)) {
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

const ASSET_FOLDER_PATTERN = /\/(figures|tables|equations)\/[^/]+$/;

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

async function gatherSummarizeOutlineContext(
  modelRoot: string,
  sectionPath: string,
  contextPaths?: string[],
): Promise<string> {
  const entries =
    contextPaths && contextPaths.length > 0
      ? contextPaths.map((pathValue) => ({
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

export interface PreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
  providerName: string;
  sessionId: string;
  promptFile: string;
}

function promptSessionId(): string {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function buildPreview(
  modelRoot: string,
  repoRoot: string,
  unitPath: string,
  action: DispatchAction,
  provider: AiProvider,
  customPrompt?: string,
  sessionId?: string,
  contextPaths?: string[],
): Promise<PreviewResult> {
  const outlineRelPath = `${unitPath}/outline.md`;
  const indexData = await readIndexData(modelRoot, unitPath);
  const figureSourceRel = `${unitPath}/${String(indexData.figure_source ?? "source.mmd")}`;
  const outputRelPath =
    action === "refresh-index" || action === "sync-outline" || action === "summarize-outline"
      ? outlineRelPath
      : action === "generate-figure"
        ? figureSourceRel
        : `${unitPath}/draft.md`;

  const idea = await readOutlineDoc(modelRoot, unitPath);
  const links = await readIndexLinks(modelRoot, unitPath);
  const needsDraft = actionNeedsDraft(action);
  const draft = needsDraft ? stripInlineNotes(await readDraft(modelRoot, unitPath)) : "";
  let context: string;
  if (contextPaths && contextPaths.length > 0) {
    context = await gatherContextFromPaths(modelRoot, contextPaths);
  } else if (action === "summarize-outline") {
    context = await gatherSummarizeOutlineContext(modelRoot, unitPath, contextPaths);
  } else {
    context = await gatherContext(modelRoot, links);
  }

  let prompt = TEMPLATES[action]
    .replace("{idea}", idea || "(no overview defined)")
    .replace("{draft}", draft || "(no draft yet)")
    .replace("{context}", context)
    .replace("{outputPath}", outputRelPath)
    .replace("{outlinePath}", outlineRelPath)
    .replace("{figureSourcePath}", figureSourceRel)
    .replace("{captionPath}", `${unitPath}/draft.md`)
    .replace("{customPrompt}", customPrompt ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (shouldIncludeManuscriptMarkup(action, outputRelPath)) {
    prompt = `${prompt}\n\n${MANUSCRIPT_MARKUP}`;
  }

  const id = sessionId ?? promptSessionId();
  const promptsDir = path.join(repoRoot, ".treewriter-prompts");
  await mkdir(promptsDir, { recursive: true });
  const promptFile = path.join(promptsDir, `${id}.txt`);
  await writeFile(promptFile, prompt, "utf8");
  const promptRef = path.relative(modelRoot, promptFile).split(path.sep).join("/");

  const quotedOutput = shellQuote(outputRelPath);

  const argStr = provider.args
    .map((a) =>
      a === "{prompt}"
        ? `"$(cat ${shellQuote(promptRef)})"`
        : a.replace("{files}", outputRelPath),
    )
    .join(" ");

  let command = `${provider.command} ${argStr}`;
  if (!provider.writesFiles && !TTY_STDOUT_COMMANDS.has(provider.command)) {
    command += ` > ${quotedOutput}`;
  }

  return {
    prompt,
    command,
    outputPath: outputRelPath,
    providerName: provider.name,
    sessionId: id,
    promptFile: path.relative(repoRoot, promptFile).split(path.sep).join("/"),
  };
}

export async function buildFanOutPreviews(
  modelRoot: string,
  repoRoot: string,
  sectionPath: string,
  action: DispatchAction,
  provider: AiProvider,
  customPrompt?: string,
): Promise<PreviewResult[]> {
  const unitPaths = await collectUnitPaths(modelRoot, sectionPath);
  if (unitPaths.length === 0) {
    return [];
  }
  const previews: PreviewResult[] = [];
  for (const unitPath of unitPaths) {
    const sessionId = `fanout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${previews.length}`;
    previews.push(
      await buildPreview(
        modelRoot,
        repoRoot,
        unitPath,
        action,
        provider,
        customPrompt,
        sessionId,
      ),
    );
  }
  return previews;
}

const DISPATCH_RUN_TIMEOUT_MS = 20 * 60 * 1000;

export function dispatchExecEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    CI: process.env.CI ?? "1",
  };
}

/** Run a shell command under a PTY so Claude/Codex accept non-terminal-server dispatch. */
export async function execDispatchCommand(modelRoot: string, command: string): Promise<void> {
  if (!existsSync(DISPATCH_RUN_SCRIPT)) {
    throw new Error(`Missing dispatch runner: ${DISPATCH_RUN_SCRIPT}`);
  }
  try {
    await execFileAsync("python3", [DISPATCH_RUN_SCRIPT, modelRoot, command], {
      env: dispatchExecEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: DISPATCH_RUN_TIMEOUT_MS,
    });
  } catch (error) {
    const execError = error as { code?: number; stderr?: string; stdout?: string; message?: string };
    const detail =
      execError.stderr?.trim() ||
      execError.stdout?.trim() ||
      execError.message ||
      "Agent run failed";
    throw new Error(detail);
  }
}

/** Run a dispatch command in modelRoot without the terminal PTY. */
export async function runDispatch(
  modelRoot: string,
  repoRoot: string,
  unitPath: string,
  action: DispatchAction,
  provider: AiProvider,
  customPrompt?: string,
  contextPaths?: string[],
): Promise<PreviewResult> {
  const preview = await buildPreview(
    modelRoot,
    repoRoot,
    unitPath,
    action,
    provider,
    customPrompt,
    undefined,
    contextPaths,
  );

  try {
    await execDispatchCommand(modelRoot, preview.command);
    return preview;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Agent run failed");
  }
}

/** Run dispatch for every unit under a section, sequentially. */
export async function runFanOutDispatch(
  modelRoot: string,
  repoRoot: string,
  sectionPath: string,
  action: DispatchAction,
  provider: AiProvider,
  customPrompt?: string,
): Promise<PreviewResult[]> {
  const unitPaths = await collectUnitPaths(modelRoot, sectionPath);
  const results: PreviewResult[] = [];
  for (const unitPath of unitPaths) {
    results.push(await runDispatch(modelRoot, repoRoot, unitPath, action, provider, customPrompt));
  }
  return results;
}

const GIT_SYNC_RESOLVE_PROMPT = `TreeWriter automated git sync paused because uncommitted local changes under view/ blocked rebase. model/ may already be committed locally.

Use the repository root (parent of model/ and view/). Commit only view/ UI changes, then finish sync.

Steps:
1. Run git status and review changes — focus on view/; do not edit model/ unless resolving a merge conflict.
2. Stage view/: git add view/
3. Commit with a clear message summarizing the UI changes.
4. Fetch and rebase: git fetch origin && git rebase origin/$(git branch --show-current)
5. Push: git push origin HEAD

If rebase conflicts appear, resolve them carefully. When finished, confirm view/ is committed and push succeeded.`;

/** Build an AI harness command to commit view/ and unblock git sync. */
export async function buildGitSyncResolvePreview(
  repoRoot: string,
  provider: AiProvider,
  sessionId?: string,
): Promise<PreviewResult> {
  const modelRoot = path.join(repoRoot, "model");
  const id = sessionId ?? promptSessionId();
  const promptsDir = path.join(repoRoot, ".treewriter-prompts");
  await mkdir(promptsDir, { recursive: true });
  const promptFile = path.join(promptsDir, `${id}.txt`);
  await writeFile(promptFile, GIT_SYNC_RESOLVE_PROMPT, "utf8");
  const promptRef = path.relative(modelRoot, promptFile).split(path.sep).join("/");

  const argStr = provider.args
    .map((a) =>
      a === "{prompt}"
        ? `"$(cat ${shellQuote(promptRef)})"`
        : a.replace("{files}", ""),
    )
    .join(" ");

  const command = `${provider.command} ${argStr}`.trim();

  return {
    prompt: GIT_SYNC_RESOLVE_PROMPT,
    command,
    outputPath: "view/",
    providerName: provider.name,
    sessionId: id,
    promptFile: path.relative(repoRoot, promptFile).split(path.sep).join("/"),
  };
}
