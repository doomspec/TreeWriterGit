import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { gatherDispatchSkillBlock } from "../dispatchSkills.js";
import { ModelFsError, readIndexData, shellQuote } from "../modelFs.js";
import { stripInlineComments } from "../inlineComments.js";
import { stripInlineNotes } from "../inlineNotes.js";
import { MANUSCRIPT_MARKUP, shouldIncludeManuscriptMarkup } from "../manuscriptMarkup.js";
import {
  collectUnitPaths,
  readDispatchUnitContext,
  readDraftForDispatch,
  readNotesForDispatch,
  validateContextPaths,
} from "./context.js";
import { buildDispatchContextCliBlock } from "./contextPrefetch.js";
import {
  GEMINI_WORKSPACE_PREAMBLE,
  assertSafeProvider,
  isGeminiProvider,
  TTY_STDOUT_COMMANDS,
  type AiProvider,
} from "./providers.js";
import {
  actionNeedsDraft,
  actionNeedsNotes,
  NOTES_TARGET_ACTIONS,
  OUTLINE_TARGET_ACTIONS,
  TEMPLATES,
  type DispatchAction,
} from "./templates.js";
import { TEMP_NOTES_DOC } from "../draftApproval/paths.js";

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

const PROMPT_SESSION_ID_RE = /^[a-zA-Z0-9._-]+$/;

export function sanitizePromptSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  const safeId = path.basename(trimmed);
  if (!safeId || safeId !== trimmed || !PROMPT_SESSION_ID_RE.test(safeId)) {
    throw new ModelFsError("Invalid session id", 400);
  }
  return safeId;
}

export function buildProviderCommand(
  provider: AiProvider,
  promptRefFromModelCwd: string,
  outputRelPath: string,
): string {
  assertSafeProvider(provider);
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
  const safeContextPaths =
    contextPaths && contextPaths.length > 0
      ? validateContextPaths(modelRoot, contextPaths)
      : contextPaths;

  const outlineRelPath = `${unitPath}/outline.md`;
  const notesRelPath = `${unitPath}/${TEMP_NOTES_DOC}`;
  const indexData = await readIndexData(modelRoot, unitPath);
  const figureSourceRel = `${unitPath}/${String(indexData.figure_source ?? "source.mmd")}`;
  const outputRelPath =
    action === "generate-figure"
      ? figureSourceRel
      : OUTLINE_TARGET_ACTIONS.has(action)
        ? outlineRelPath
        : NOTES_TARGET_ACTIONS.has(action)
          ? notesRelPath
          : `${unitPath}/draft.md`;

  const { idea, context } = await readDispatchUnitContext(modelRoot, unitPath, action, safeContextPaths);
  const needsDraft = actionNeedsDraft(action);
  const draft = needsDraft
    ? stripInlineComments(stripInlineNotes(await readDraftForDispatch(modelRoot, unitPath)))
    : "";
  const notes = actionNeedsNotes(action) ? await readNotesForDispatch(modelRoot, unitPath) : "";

  let prompt = TEMPLATES[action]
    .replace("{idea}", idea || "(no overview defined)")
    .replace("{draft}", draft || "(no draft yet)")
    .replace("{notes}", notes || "(no notes yet)")
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

  const contextCliBlock = await buildDispatchContextCliBlock(repoRoot);
  if (contextCliBlock) {
    prompt = `${prompt}\n\n${contextCliBlock}`;
  }

  if (shouldIncludeManuscriptMarkup(action, outputRelPath)) {
    prompt = `${prompt}\n\n${MANUSCRIPT_MARKUP}`;
  }

  if (isGeminiProvider(provider)) {
    prompt = `${GEMINI_WORKSPACE_PREAMBLE}${prompt}`;
  }

  const id = sanitizePromptSessionId(sessionId ?? promptSessionId());
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
