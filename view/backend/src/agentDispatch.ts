import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

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

export type DispatchAction = "draft" | "revise" | "expand" | "cite-check" | "custom";

// Template variables: {idea}, {draft}, {context}, {outputPath}, {customPrompt}
const TEMPLATES: Record<DispatchAction, string> = {
  draft: `Write a complete, publication-quality paragraph for the following section of a scientific paper.

SECTION IDEA:
{idea}

{context}

Write the paragraph directly to file {outputPath}. Overwrite any existing content. Use formal academic language. No preamble or meta-commentary — output only the paragraph text.`,

  revise: `Revise the following draft paragraph for clarity, precision, and scientific rigor.

SECTION IDEA (what this paragraph must convey):
{idea}

CURRENT DRAFT:
{draft}

{context}

Write the revised paragraph directly to file {outputPath}. Preserve all factual claims and citations.`,

  expand: `Expand the following paragraph with additional detail, supporting evidence, and improved transitions.

SECTION IDEA:
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
};

async function readUnit(
  modelRoot: string,
  unitPath: string,
): Promise<{ idea: string; links: string[] }> {
  try {
    const raw = await readFile(path.join(modelRoot, unitPath, "INDEX.md"), "utf8");
    const parsed = matter(raw);
    return {
      idea: parsed.content.trim(),
      links: Array.isArray(parsed.data.links) ? (parsed.data.links as string[]) : [],
    };
  } catch {
    return { idea: "", links: [] };
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
      let raw = "";
      try {
        raw = await readFile(path.join(modelRoot, link, "INDEX.md"), "utf8");
      } catch {
        raw = await readFile(path.join(modelRoot, `${link}.md`), "utf8");
      }
      const parsed = matter(raw);
      const snippet = parsed.content.trim().slice(0, 500);
      if (snippet) parts.push(`[${link}]\n${snippet}`);
    } catch {
      // unresolved link — skip silently
    }
  }
  return parts.length > 0 ? `RELATED SECTIONS:\n${parts.join("\n\n")}` : "";
}

export interface PreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
  providerName: string;
}

export async function buildPreview(
  modelRoot: string,
  repoRoot: string,
  unitPath: string,
  action: DispatchAction,
  provider: AiProvider,
  customPrompt?: string,
): Promise<PreviewResult> {
  // outputPath is relative to modelRoot (== terminal cwd)
  const outputRelPath = `${unitPath}/draft.md`;

  const { idea, links } = await readUnit(modelRoot, unitPath);
  const needsDraft = action !== "draft" && action !== "custom";
  const draft = needsDraft ? await readDraft(modelRoot, unitPath) : "";
  const context = await gatherContext(modelRoot, links);

  const prompt = TEMPLATES[action]
    .replace("{idea}", idea || "(no idea defined)")
    .replace("{draft}", draft || "(no draft yet)")
    .replace("{context}", context)
    .replace("{outputPath}", outputRelPath)
    .replace("{customPrompt}", customPrompt ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Write to file so the shell command avoids inline escaping of multiline text.
  // Terminal cwd is modelRoot; prompt file is one level up at repoRoot.
  const promptFile = path.join(repoRoot, ".treewriter-prompt.txt");
  await writeFile(promptFile, prompt, "utf8");
  const promptRef = `../.treewriter-prompt.txt`; // relative from terminal's cwd (model/)

  const argStr = provider.args
    .map((a) =>
      a === "{prompt}"
        ? `"$(cat ${promptRef})"`
        : a.replace("{files}", outputRelPath),
    )
    .join(" ");

  let command = `${provider.command} ${argStr}`;
  if (!provider.writesFiles) {
    command += ` > ${outputRelPath}`;
  }

  return { prompt, command, outputPath: outputRelPath, providerName: provider.name };
}
