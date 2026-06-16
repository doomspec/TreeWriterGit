import path from "node:path";
import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";

import { isUnitDir, orderedChildren, resolveChildPath, shellQuote } from "./modelFs.js";

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
];

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

export type DispatchAction = "draft" | "revise" | "expand" | "cite-check" | "custom" | "refresh-index" | "sync-outline";

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

Write an updated outline.md to {outlinePath}. Summarize what the draft actually says — main point, claims, and citations to preserve. The overview guides future draft revisions.`,
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
  return action !== "draft" && action !== "custom" && action !== "refresh-index";
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
  if (paperRel) {
    candidates.push(
      ...(await listNoteContextFiles(modelRoot, paperRel, "literature", "literature", true)),
      ...(await listNoteContextFiles(modelRoot, paperRel, "data", "data", false)),
      ...(await listNoteContextFiles(modelRoot, paperRel, "feedback", "feedback", false)),
    );
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
  const outputRelPath =
    action === "refresh-index" || action === "sync-outline"
      ? outlineRelPath
      : `${unitPath}/draft.md`;

  const idea = await readOutlineDoc(modelRoot, unitPath);
  const links = await readIndexLinks(modelRoot, unitPath);
  const needsDraft = actionNeedsDraft(action);
  const draft = needsDraft ? await readDraft(modelRoot, unitPath) : "";
  let context: string;
  if (contextPaths && contextPaths.length > 0) {
    context = await gatherContextFromPaths(modelRoot, contextPaths);
  } else {
    context = await gatherContext(modelRoot, links);
  }

  const prompt = TEMPLATES[action]
    .replace("{idea}", idea || "(no overview defined)")
    .replace("{draft}", draft || "(no draft yet)")
    .replace("{context}", context)
    .replace("{outputPath}", outputRelPath)
    .replace("{outlinePath}", outlineRelPath)
    .replace("{customPrompt}", customPrompt ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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
  if (!provider.writesFiles) {
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
