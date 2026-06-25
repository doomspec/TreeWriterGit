import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { shellQuote } from "../modelFs.js";
import {
  buildPreview,
  buildProviderCommand,
  promptFileRelFromModelCwd,
  promptSessionId,
  promptsDirectory,
  type PreviewResult,
} from "./commands.js";
import { collectUnitPaths } from "./context.js";
import { isGeminiProvider, type AiProvider } from "./providers.js";
import type { DispatchAction } from "./templates.js";

const execFileAsync = promisify(execFile);
const DISPATCH_RUN_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dispatch_run.py",
);

const DISPATCH_RUN_TIMEOUT_MS = 20 * 60 * 1000;

const GIT_SYNC_RESOLVE_PROMPT = `TreeWriter automated git sync paused because uncommitted local changes under view/ blocked rebase. model/ may already be committed locally.

Use the repository root (parent of model/ and view/). Commit only view/ UI changes, then finish sync.

Steps:
1. Run git status and review changes — focus on view/; do not edit model/ unless resolving a merge conflict.
2. Stage view/: git add view/
3. Commit with a clear message summarizing the UI changes.
4. Fetch and rebase: git fetch origin && git rebase origin/$(git branch --show-current)
5. Push: git push origin HEAD

If rebase conflicts appear, resolve them carefully. When finished, confirm view/ is committed and push succeeded.`;

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

/** Build an AI harness command to commit view/ and unblock git sync. */
export async function buildGitSyncResolvePreview(
  repoRoot: string,
  provider: AiProvider,
  sessionId?: string,
): Promise<PreviewResult> {
  const modelRoot = path.join(repoRoot, "model");
  const id = sessionId ?? promptSessionId();
  const promptsDir = promptsDirectory(modelRoot);
  await mkdir(promptsDir, { recursive: true });
  const promptFile = path.join(promptsDir, `${id}.txt`);
  await writeFile(promptFile, GIT_SYNC_RESOLVE_PROMPT, "utf8");
  const promptRefFromModel = promptFileRelFromModelCwd(id);

  let command: string;
  if (isGeminiProvider(provider)) {
    const extraArgs = provider.args.filter((arg) => arg !== "{prompt}").join(" ");
    const promptRefFromRepo = path.join("model", promptRefFromModel).split(path.sep).join("/");
    command =
      `cd ${shellQuote(repoRoot)} && cat ${shellQuote(promptRefFromRepo)} | ${provider.command}` +
      (extraArgs ? ` ${extraArgs}` : "");
  } else {
    command = buildProviderCommand(provider, promptRefFromModel, "view/");
  }

  return {
    prompt: GIT_SYNC_RESOLVE_PROMPT,
    command,
    outputPath: "view/",
    providerName: provider.name,
    sessionId: id,
    promptFile: path.relative(repoRoot, promptFile).split(path.sep).join("/"),
  };
}
