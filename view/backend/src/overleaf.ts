import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { copyModularBundleToDir, exportModularPaper } from "./exportModular.js";
import type { ExportValidationConfig } from "@treewriter/shared";

const execFileAsync = promisify(execFile);

export interface OverleafPushResult {
  repoPath: string;
  committed: boolean;
  message: string;
  exportPath: string;
  missingCitations?: string[];
  orphanCrossRefs?: string[];
}

export interface OverleafImportResult {
  imported: number;
  paths: string[];
}

export interface OverleafStatus {
  connected: boolean;
  repoPath: string | null;
  gitUrl: string | null;
  projectId: string | null;
}

export interface OverleafConnectResult {
  repoPath: string;
  gitUrl: string;
  projectId: string;
  action: "cloned" | "pulled" | "linked";
  message: string;
}

const OVERLEAF_PROJECT_ID = /[a-f0-9]{24}/i;

export function overleafCloneDir(repoRoot: string, paperSlug: string): string {
  return path.join(repoRoot, ".overleaf", paperSlug.trim());
}

/** Normalize Overleaf Git Bridge URLs and bare project ids. */
export function parseOverleafGitUrl(raw: string): { projectId: string; httpsCloneUrl: string } {
  let input = raw.trim().replace(/^git\s+clone\s+/i, "").trim();
  input = input.replace(/^['"]|['"]$/g, "");

  const bareId = input.match(new RegExp(`^(${OVERLEAF_PROJECT_ID.source})$`, "i"));
  if (bareId) {
    const projectId = bareId[1]!.toLowerCase();
    return { projectId, httpsCloneUrl: `https://git.overleaf.com/${projectId}` };
  }

  const ssh = input.match(
    new RegExp(`^(?:ssh://)?git@git\\.overleaf\\.com:(${OVERLEAF_PROJECT_ID.source})/?$`, "i"),
  );
  if (ssh) {
    const projectId = ssh[1]!.toLowerCase();
    return { projectId, httpsCloneUrl: `https://git.overleaf.com/${projectId}` };
  }

  const https = input.match(
    new RegExp(`^https?://(?:git@)?git\\.overleaf\\.com/(${OVERLEAF_PROJECT_ID.source})/?$`, "i"),
  );
  if (https) {
    const projectId = https[1]!.toLowerCase();
    return { projectId, httpsCloneUrl: `https://git.overleaf.com/${projectId}` };
  }

  throw new ModelFsError(
    "Invalid Overleaf Git URL. In Overleaf open Menu → Git and paste the clone URL here.",
    400,
  );
}

function cloneUrlWithToken(httpsCloneUrl: string, token?: string): string {
  const trimmed = token?.trim();
  if (!trimmed) return httpsCloneUrl;
  return httpsCloneUrl.replace("https://", `https://git:${encodeURIComponent(trimmed)}@`);
}

async function readPaperIndex(modelRoot: string, paperSlug: string) {
  const paperRel = `papers/${paperSlug.trim()}`;
  resolveModelPath(modelRoot, paperRel);
  const indexAbs = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`Paper not found: ${paperSlug}`, 404);
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  return { paperRel, indexAbs, parsed };
}

async function writeOverleafConnection(
  indexAbs: string,
  parsed: { content: string; data: Record<string, unknown> },
  repoPath: string,
  gitUrl: string,
): Promise<void> {
  const nextFrontmatter = {
    ...parsed.data,
    overleaf_repo_path: repoPath,
    overleaf_git_url: gitUrl,
  };
  await writeFile(indexAbs, matter.stringify(parsed.content, nextFrontmatter), "utf8");
}

async function ensureOverleafClone(
  httpsCloneUrl: string,
  targetPath: string,
  token?: string,
): Promise<"cloned" | "pulled" | "linked"> {
  const authUrl = cloneUrlWithToken(httpsCloneUrl, token);
  const gitDir = path.join(targetPath, ".git");

  if (existsSync(gitDir)) {
    try {
      await execFileAsync("git", ["-C", targetPath, "remote", "get-url", "origin"]);
      await execFileAsync("git", ["-C", targetPath, "remote", "set-url", "origin", authUrl]);
    } catch {
      await execFileAsync("git", ["-C", targetPath, "remote", "add", "origin", authUrl]);
    }
    try {
      await execFileAsync("git", ["-C", targetPath, "pull", "--ff-only"]);
      return "pulled";
    } catch {
      return "linked";
    }
  }

  if (existsSync(targetPath)) {
    throw new ModelFsError(
      `Cannot clone Overleaf project: ${targetPath} exists but is not a git repository`,
      409,
    );
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await execFileAsync("git", ["clone", authUrl, targetPath]);
  return "cloned";
}

export async function getOverleafStatus(
  modelRoot: string,
  paperSlug: string,
): Promise<OverleafStatus> {
  const { parsed } = await readPaperIndex(modelRoot, paperSlug);
  const repoPath = parsed.data.overleaf_repo_path ? String(parsed.data.overleaf_repo_path) : null;
  const gitUrl = parsed.data.overleaf_git_url ? String(parsed.data.overleaf_git_url) : null;
  let projectId: string | null = null;
  if (gitUrl) {
    try {
      projectId = parseOverleafGitUrl(gitUrl).projectId;
    } catch {
      projectId = null;
    }
  }
  const connected = Boolean(repoPath && existsSync(path.join(repoPath, ".git")));
  return { connected, repoPath, gitUrl, projectId };
}

/** Clone or link an Overleaf Git Bridge project and store paths on the paper INDEX. */
export async function connectOverleafProject(
  modelRoot: string,
  repoRoot: string,
  paperSlug: string,
  gitUrlInput: string,
  token?: string,
): Promise<OverleafConnectResult> {
  const { httpsCloneUrl, projectId } = parseOverleafGitUrl(gitUrlInput);
  const { indexAbs, parsed } = await readPaperIndex(modelRoot, paperSlug);

  const configuredPath = parsed.data.overleaf_repo_path
    ? String(parsed.data.overleaf_repo_path)
    : "";
  const defaultPath = overleafCloneDir(repoRoot, paperSlug);
  const targetPath =
    configuredPath && (existsSync(configuredPath) || configuredPath.startsWith(repoRoot))
      ? configuredPath
      : defaultPath;

  let action: OverleafConnectResult["action"];
  try {
    action = await ensureOverleafClone(httpsCloneUrl, targetPath, token);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/Authentication failed|403|401|could not read Username/i.test(detail)) {
      throw new ModelFsError(
        "Overleaf git authentication failed. Add your Overleaf Git token (Account → Git integration) and try again.",
        401,
      );
    }
    throw error;
  }

  await writeOverleafConnection(indexAbs, parsed, targetPath, httpsCloneUrl);

  const message =
    action === "cloned"
      ? "Connected — cloned Overleaf project locally"
      : action === "pulled"
        ? "Connected — pulled latest from Overleaf"
        : "Connected — using existing local Overleaf clone";

  return {
    repoPath: targetPath,
    gitUrl: httpsCloneUrl,
    projectId,
    action,
    message,
  };
}

const TODO_PATTERNS: RegExp[] = [
  /\\todo\{([^}]*)\}/gi,
  /\\TODO\{([^}]*)\}/g,
  /%+\s*TODO:?\s*(.+)$/gim,
];

const INLINE_NOTE_PATTERN = /\\([a-zA-Z]{1,12})\{([^}]*)\}/g;

async function readOverleafRepoPath(
  modelRoot: string,
  paperSlug: string,
): Promise<{ overleafPath: string; paperRel: string }> {
  const { paperRel, parsed } = await readPaperIndex(modelRoot, paperSlug);
  const overleafPath = parsed.data.overleaf_repo_path ? String(parsed.data.overleaf_repo_path) : "";
  if (!overleafPath) {
    throw new ModelFsError(
      "Paper is not connected to Overleaf. Use Export → Connect Overleaf first.",
      400,
    );
  }
  if (!existsSync(overleafPath)) {
    throw new ModelFsError(`Overleaf repo path does not exist: ${overleafPath}`, 404);
  }
  return { overleafPath, paperRel };
}

function extractTodoComments(tex: string): string[] {
  const found = new Set<string>();
  for (const pattern of TODO_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(tex)) !== null) {
      const text = match[1]?.trim();
      if (text) found.add(text);
    }
  }
  INLINE_NOTE_PATTERN.lastIndex = 0;
  let noteMatch: RegExpExecArray | null;
  while ((noteMatch = INLINE_NOTE_PATTERN.exec(tex)) !== null) {
    const author = noteMatch[1]?.trim();
    const text = noteMatch[2]?.trim();
    if (author && text && author.toLowerCase() !== "todo") {
      found.add(`[${author}] ${text}`);
    }
  }
  return [...found];
}

/** Copy modular export bundle into the paper's Overleaf Git Bridge clone and commit. */
export async function pushToOverleaf(
  modelRoot: string,
  repoRoot: string,
  paperSlug: string,
  includeDrafts = false,
  validation?: ExportValidationConfig,
): Promise<OverleafPushResult> {
  const { parsed } = await readPaperIndex(modelRoot, paperSlug);
  const overleafPath = parsed.data.overleaf_repo_path ? String(parsed.data.overleaf_repo_path) : "";
  if (!overleafPath) {
    throw new ModelFsError(
      "Paper is not connected to Overleaf. Use Export → Connect Overleaf first.",
      400,
    );
  }
  if (!existsSync(overleafPath)) {
    throw new ModelFsError(`Overleaf repo path does not exist: ${overleafPath}`, 404);
  }

  const bundle = await exportModularPaper(modelRoot, repoRoot, {
    paperSlug,
    includeDrafts,
    validation,
  });

  const copied = await copyModularBundleToDir(repoRoot, bundle, overleafPath);

  let committed = false;
  let message = `Copied ${copied.length} files (main.tex, references.bib, sections/) to Overleaf repo`;

  try {
    await execFileAsync("git", ["-C", overleafPath, "add", "main.tex", "references.bib", "sections"]);
    if (bundle.assetFiles.length > 0) {
      await execFileAsync("git", ["-C", overleafPath, "add", ...bundle.assetFiles]);
    }
    const { stdout } = await execFileAsync("git", ["-C", overleafPath, "status", "--porcelain"]);
    if (stdout.trim()) {
      await execFileAsync("git", [
        "-C",
        overleafPath,
        "commit",
        "-m",
        "Sync from TreeWriter",
      ]);
      committed = true;
      message = "Committed modular export to Overleaf repo";
      try {
        await execFileAsync("git", ["-C", overleafPath, "push"]);
        message = "Pushed modular export to Overleaf remote";
      } catch {
        message = "Committed locally; git push failed (check Overleaf remote credentials)";
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message = `Files copied; git step failed: ${detail}`;
  }

  return {
    repoPath: overleafPath,
    committed,
    message,
    exportPath: bundle.mainTex,
    ...(bundle.missingCitations.length > 0 ? { missingCitations: bundle.missingCitations } : {}),
    ...(bundle.orphanCrossRefs.length > 0 ? { orphanCrossRefs: bundle.orphanCrossRefs } : {}),
  };
}

/** Parse \\todo / TODO comments from main.tex and section files; write feedback notes. */
export async function importOverleafFeedback(
  modelRoot: string,
  paperSlug: string,
): Promise<OverleafImportResult> {
  const { overleafPath, paperRel } = await readOverleafRepoPath(modelRoot, paperSlug);
  const texPaths: string[] = [];
  const mainPath = path.join(overleafPath, "main.tex");
  if (existsSync(mainPath)) texPaths.push(mainPath);

  const sectionsDir = path.join(overleafPath, "sections");
  if (existsSync(sectionsDir)) {
    const { readdir } = await import("node:fs/promises");
    for (const file of await readdir(sectionsDir)) {
      if (file.endsWith(".tex")) {
        texPaths.push(path.join(sectionsDir, file));
      }
    }
  }

  if (texPaths.length === 0) {
    throw new ModelFsError("main.tex not found in Overleaf repo", 404);
  }

  const items = new Set<string>();
  for (const texPath of texPaths) {
    for (const item of extractTodoComments(await readFile(texPath, "utf8"))) {
      items.add(item);
    }
  }
  if (items.size === 0) {
    return { imported: 0, paths: [] };
  }

  const feedbackDir = path.join(modelRoot, paperRel, "notes", "feedback");
  await mkdir(feedbackDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const paths: string[] = [];

  for (let i = 0; i < items.size; i++) {
    const rel = `${paperRel}/notes/feedback/overleaf-${date}-${i + 1}.md`;
    const body = `# Overleaf feedback\n\nImported from Overleaf on ${date}.\n\n> ${[...items][i]}\n`;
    await writeFile(
      path.join(modelRoot, rel),
      matter.stringify(body, {
        kind: "note",
        title: `Overleaf feedback ${date} #${i + 1}`,
        source: "overleaf",
        resolved: false,
      }),
      "utf8",
    );
    paths.push(rel);
  }

  return { imported: paths.length, paths };
}
