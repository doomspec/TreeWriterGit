import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { gatherDispatchSkillBlock } from "../dispatchSkills.js";
import { readIndexData, shellQuote } from "../modelFs.js";
import { stripInlineNotes } from "../inlineNotes.js";
import { MANUSCRIPT_MARKUP, shouldIncludeManuscriptMarkup } from "../manuscriptMarkup.js";
import {
  collectUnitPaths,
  readDispatchUnitContext,
  readDraftForDispatch,
} from "./context.js";
import { buildDispatchContextCliBlock } from "./contextPrefetch.js";
import {
  GEMINI_WORKSPACE_PREAMBLE,
  isGeminiProvider,
  TTY_STDOUT_COMMANDS,
  type AiProvider,
} from "./providers.js";
import { actionNeedsDraft, TEMPLATES, type DispatchAction } from "./templates.js";

export interface PreviewResult {
  prompt: string;
  command: string;
  outputPath: string;
  providerName: string;
  sessionId: string;
  promptFile: string;
}

export function promptsDirectory(modelRoot: string): string {
  return path.join(modelRoot, ".treewriter-prompts");
}

export function promptFileRelFromModelCwd(sessionId: string): string {
  return `.treewriter-prompts/${sessionId}.txt`;
}

export function promptSessionId(): string {
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildProviderCommand(
  provider: AiProvider,
  promptRefFromModelCwd: string,
  outputRelPath: string,
): string {
  const catPrompt = `cat ${shellQuote(promptRefFromModelCwd)}`;

  if (isGeminiProvider(provider)) {
    const extraArgs = provider.args.filter((arg) => arg !== "{prompt}").join(" ");
    let command = `${catPrompt} | ${provider.command}${extraArgs ? ` ${extraArgs}` : ""}`;
    if (!provider.writesFiles && !TTY_STDOUT_COMMANDS.has(provider.command)) {
      command += ` > ${shellQuote(outputRelPath)}`;
    }
    return command;
  }

  const argStr = provider.args
    .map((arg) =>
      arg === "{prompt}"
        ? `"$(${catPrompt})"`
        : arg.replace("{files}", outputRelPath),
    )
    .join(" ");

  let command = `${provider.command} ${argStr}`;
  if (!provider.writesFiles && !TTY_STDOUT_COMMANDS.has(provider.command)) {
    command += ` > ${shellQuote(outputRelPath)}`;
  }
  return command;
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

  const { idea, context } = await readDispatchUnitContext(modelRoot, unitPath, action, contextPaths);
  const needsDraft = actionNeedsDraft(action);
  const draft = needsDraft ? stripInlineNotes(await readDraftForDispatch(modelRoot, unitPath)) : "";

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

  const skillBlock = await gatherDispatchSkillBlock(repoRoot);
  if (skillBlock) {
    prompt = `${prompt}\n\n${skillBlock}`;
  }

  const contextCliBlock = buildDispatchContextCliBlock(repoRoot);
  if (contextCliBlock) {
    prompt = `${prompt}\n\n${contextCliBlock}`;
  }

  if (shouldIncludeManuscriptMarkup(action, outputRelPath)) {
    prompt = `${prompt}\n\n${MANUSCRIPT_MARKUP}`;
  }

  if (isGeminiProvider(provider)) {
    prompt = `${GEMINI_WORKSPACE_PREAMBLE}${prompt}`;
  }

  const id = sessionId ?? promptSessionId();
  const promptsDir = promptsDirectory(modelRoot);
  await mkdir(promptsDir, { recursive: true });
  const promptFile = path.join(promptsDir, `${id}.txt`);
  await writeFile(promptFile, prompt, "utf8");
  const promptRef = promptFileRelFromModelCwd(id);

  const command = buildProviderCommand(provider, promptRef, outputRelPath);

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
    const fanoutSessionId = `fanout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${previews.length}`;
    previews.push(
      await buildPreview(
        modelRoot,
        repoRoot,
        unitPath,
        action,
        provider,
        customPrompt,
        fanoutSessionId,
      ),
    );
  }
  return previews;
}
