import path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import matter from "gray-matter";

import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { exportPaper } from "./export.js";

const execFileAsync = promisify(execFile);

export interface OverleafPushResult {
  repoPath: string;
  committed: boolean;
  message: string;
  exportPath: string;
  missingCitations?: string[];
}

export interface OverleafImportResult {
  imported: number;
  paths: string[];
}

const TODO_PATTERNS: RegExp[] = [
  /\\todo\{([^}]*)\}/gi,
  /\\TODO\{([^}]*)\}/g,
  /%+\s*TODO:?\s*(.+)$/gim,
];

async function readOverleafRepoPath(
  modelRoot: string,
  paperSlug: string,
): Promise<{ overleafPath: string; paperRel: string }> {
  const paperRel = `papers/${paperSlug.trim()}`;
  resolveModelPath(modelRoot, paperRel);
  const indexAbs = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`Paper not found: ${paperSlug}`, 404);
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const overleafPath = parsed.data.overleaf_repo_path ? String(parsed.data.overleaf_repo_path) : "";
  if (!overleafPath) {
    throw new ModelFsError("Paper has no overleaf_repo_path configured in INDEX.md", 400);
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
  return [...found];
}

/** Copy exported .tex (+ .bib) into the paper's Overleaf Git Bridge clone and commit. */
export async function pushToOverleaf(
  modelRoot: string,
  repoRoot: string,
  paperSlug: string,
  includeDrafts = false,
): Promise<OverleafPushResult> {
  const paperRel = `papers/${paperSlug.trim()}`;
  resolveModelPath(modelRoot, paperRel);
  const indexAbs = path.join(modelRoot, paperRel, "INDEX.md");
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`Paper not found: ${paperSlug}`, 404);
  }

  const parsed = matter(await readFile(indexAbs, "utf8"));
  const overleafPath = parsed.data.overleaf_repo_path ? String(parsed.data.overleaf_repo_path) : "";
  if (!overleafPath) {
    throw new ModelFsError("Paper has no overleaf_repo_path configured in INDEX.md", 400);
  }
  if (!existsSync(overleafPath)) {
    throw new ModelFsError(`Overleaf repo path does not exist: ${overleafPath}`, 404);
  }

  const exportResult = await exportPaper(modelRoot, repoRoot, {
    paperSlug,
    format: "latex",
    includeDrafts,
  });

  const exportAbs = path.join(repoRoot, exportResult.path);
  const bibSource = exportAbs.replace(/\.tex$/, ".bib");

  await copyFile(exportAbs, path.join(overleafPath, "main.tex"));
  if (existsSync(bibSource)) {
    await copyFile(bibSource, path.join(overleafPath, "references.bib"));
  }

  let committed = false;
  let message = "Copied main.tex to Overleaf repo";

  try {
    const filesToAdd = ["main.tex"];
    if (existsSync(path.join(overleafPath, "references.bib"))) {
      filesToAdd.push("references.bib");
    }
    await execFileAsync("git", ["-C", overleafPath, "add", ...filesToAdd]);
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
      message = "Committed main.tex to Overleaf repo";
      try {
        await execFileAsync("git", ["-C", overleafPath, "push"]);
        message = "Pushed main.tex to Overleaf remote";
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
    exportPath: exportResult.path,
    ...(exportResult.missingCitations?.length
      ? { missingCitations: exportResult.missingCitations }
      : {}),
  };
}

/** Parse \\todo / TODO comments from main.tex and write feedback notes. */
export async function importOverleafFeedback(
  modelRoot: string,
  paperSlug: string,
): Promise<OverleafImportResult> {
  const { overleafPath, paperRel } = await readOverleafRepoPath(modelRoot, paperSlug);
  const texPath = path.join(overleafPath, "main.tex");
  if (!existsSync(texPath)) {
    throw new ModelFsError("main.tex not found in Overleaf repo", 404);
  }

  const tex = await readFile(texPath, "utf8");
  const items = extractTodoComments(tex);
  if (items.length === 0) {
    return { imported: 0, paths: [] };
  }

  const feedbackDir = path.join(modelRoot, paperRel, "notes", "feedback");
  await mkdir(feedbackDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const paths: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const rel = `${paperRel}/notes/feedback/overleaf-${date}-${i + 1}.md`;
    const body = `# Overleaf feedback\n\nImported from main.tex on ${date}.\n\n> ${items[i]}\n`;
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
