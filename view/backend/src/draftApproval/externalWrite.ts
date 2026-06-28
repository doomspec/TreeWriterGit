import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";

import { loadProviders } from "../agentDispatch.js";
import {
  GEMINI_WORKSPACE_PREAMBLE,
  isGeminiProvider,
} from "../agentDispatch/providers.js";
import { promptsDirectory } from "../agentDispatch/commands.js";
import type { AgentJobManager } from "../agentJobManager.js";
import { wasRecentApiWrite } from "../modelEvents.js";
import { listSessions } from "../sessions.js";
import {
  isApprovalTrackedFilePath,
  manuscriptKindFromFilePath,
  manuscriptMatchesApproved,
  unitDirFromManuscriptFile,
} from "./paths.js";
import {
  markDraftAiAssisted,
  markOutlineAiAssisted,
  markManuscriptUnapproved,
  readEditMetaForFile,
  readManuscriptEditMeta,
  type DraftEditMeta,
} from "./meta.js";

const RECENT_AI_MS = 2 * 60 * 60 * 1000;

type AiInference = {
  provider: string;
  editedBy?: string | null;
};

async function inferAiFromRecentSessions(
  modelRoot: string,
  unitRel: string,
): Promise<AiInference | null> {
  const sessions = await listSessions(modelRoot, unitRel);
  const cutoff = Date.now() - RECENT_AI_MS;
  for (const session of sessions) {
    if (session.status === "skipped") continue;
    const at = Date.parse(session.at);
    if (Number.isNaN(at) || at < cutoff) continue;
    const provider = session.provider?.trim();
    if (!provider) continue;
    return { provider };
  }
  return null;
}

async function inferAiFromRecentPrompt(
  modelRoot: string,
  repoRoot: string,
  outputRel: string,
): Promise<AiInference | null> {
  const promptsDir = promptsDirectory(modelRoot);
  if (!existsSync(promptsDir)) return null;

  const normalizedOutput = outputRel.replace(/\\/g, "/");
  const cutoff = Date.now() - RECENT_AI_MS;
  const entries = await readdir(promptsDir);
  const candidates: { name: string; mtimeMs: number }[] = [];

  for (const name of entries) {
    if (!name.endsWith(".txt")) continue;
    const abs = path.join(promptsDir, name);
    const fileStat = await stat(abs);
    if (fileStat.mtimeMs < cutoff) continue;
    candidates.push({ name, mtimeMs: fileStat.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const config = await loadProviders(repoRoot);

  for (const { name } of candidates) {
    const content = await readFile(path.join(promptsDir, name), "utf8");
    if (!content.includes(normalizedOutput)) continue;
    if (content.startsWith(GEMINI_WORKSPACE_PREAMBLE)) {
      const gemini = config.aiProviders.find((provider) => isGeminiProvider(provider));
      if (gemini) return { provider: gemini.name };
    }
    return {
      provider:
        config.defaultProvider?.trim() ||
        config.aiProviders[0]?.name?.trim() ||
        "AI",
    };
  }

  return null;
}

function inferAiFromRecentJob(
  agentJobs: AgentJobManager | undefined,
  unitRel: string,
): AiInference | null {
  if (!agentJobs) return null;
  const cutoff = Date.now() - RECENT_AI_MS;
  for (const job of agentJobs.listForUnit(unitRel)) {
    if (job.state !== "succeeded" && job.state !== "running") continue;
    const stamp = job.finishedAt ?? job.startedAt ?? job.createdAt;
    const at = Date.parse(stamp);
    if (Number.isNaN(at) || at < cutoff) continue;
    const provider = job.providerName?.trim();
    if (!provider) continue;
    return { provider };
  }
  return null;
}

async function inferExternalAiEdit(
  modelRoot: string,
  repoRoot: string,
  unitRel: string,
  outputRel: string,
  agentJobs?: AgentJobManager,
): Promise<AiInference | null> {
  return (
    (await inferAiFromRecentSessions(modelRoot, unitRel)) ??
    inferAiFromRecentJob(agentJobs, unitRel) ??
    (await inferAiFromRecentPrompt(modelRoot, repoRoot, outputRel))
  );
}

/** Watch-driven draft/outline writes (terminal AI, external editors) update approval metadata. */
export async function handleExternalManuscriptWrite(
  modelRoot: string,
  fileRel: string,
  options?: { repoRoot?: string; agentJobs?: AgentJobManager },
): Promise<string[]> {
  const normalized = fileRel.replace(/\\/g, "/");
  if (!isApprovalTrackedFilePath(normalized)) return [];
  if (wasRecentApiWrite(normalized)) return [];

  const kind = manuscriptKindFromFilePath(normalized);
  const unitRel = unitDirFromManuscriptFile(normalized, kind);
  const repoRoot = options?.repoRoot ?? path.dirname(modelRoot);

  const ai = await inferExternalAiEdit(
    modelRoot,
    repoRoot,
    unitRel,
    normalized,
    options?.agentJobs,
  );

  if (ai) {
    return kind === "draft"
      ? markDraftAiAssisted(modelRoot, unitRel, ai.editedBy ?? null, ai.provider)
      : markOutlineAiAssisted(modelRoot, unitRel, ai.editedBy ?? null, ai.provider);
  }

  return markManuscriptUnapproved(modelRoot, unitRel, kind, {
    editedBy: null,
    aiAssisted: false,
    aiProvider: null,
  });
}

/** When a pending manuscript loads, upgrade stale INDEX metadata from recent AI activity. */
export async function refreshPendingManuscriptMeta(
  modelRoot: string,
  fileRel: string,
  options?: { repoRoot?: string; agentJobs?: AgentJobManager },
): Promise<{ updated: string[]; meta: DraftEditMeta }> {
  const normalized = fileRel.replace(/\\/g, "/");
  if (!isApprovalTrackedFilePath(normalized)) {
    return { updated: [], meta: await readEditMetaForFile(modelRoot, normalized) };
  }

  const kind = manuscriptKindFromFilePath(normalized);
  const unitRel = unitDirFromManuscriptFile(normalized, kind);

  if (await manuscriptMatchesApproved(modelRoot, unitRel, kind)) {
    return { updated: [], meta: await readManuscriptEditMeta(modelRoot, unitRel, kind) };
  }

  const current = await readManuscriptEditMeta(modelRoot, unitRel, kind);
  if (current.aiAssisted) {
    return { updated: [], meta: current };
  }

  const ai = await inferExternalAiEdit(
    modelRoot,
    options?.repoRoot ?? path.dirname(modelRoot),
    unitRel,
    normalized,
    options?.agentJobs,
  );
  if (!ai) {
    return { updated: [], meta: current };
  }

  const updated =
    kind === "draft"
      ? await markDraftAiAssisted(modelRoot, unitRel, ai.editedBy ?? null, ai.provider)
      : await markOutlineAiAssisted(modelRoot, unitRel, ai.editedBy ?? null, ai.provider);

  return { updated, meta: await readManuscriptEditMeta(modelRoot, unitRel, kind) };
}
