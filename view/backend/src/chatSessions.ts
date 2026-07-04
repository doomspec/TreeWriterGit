import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { normalizeUnitPath, wikiRootFromUnitPath } from "./sessionWiki.js";

/**
 * Repo-versioned traces for AI assistant chat sessions (plans/ai-assistant-panel.md,
 * Stage 3). One markdown file per session under the paper's notes/sessions/ folder,
 * distinct from the day-batched dispatch log files in sessionWiki.ts. Turns are
 * appended as they happen so a crash never loses the trace.
 */

export type ChatMode = "pty" | "bridged";
export type ChatRole = "user" | "assistant";

export type ChatSessionMeta = {
  provider: string;
  mode: ChatMode;
  startedAt: string;
  unitPath: string;
  terminalSessionId?: string;
  agentSessionId?: string;
  contextFiles?: string[];
};

export type ChatTurn = {
  role: ChatRole;
  text: string;
  at: string;
};

export type ChatSessionFile = ChatSessionMeta & {
  id: string;
  filename: string;
  wikiPath: string;
  turns: ChatTurn[];
};

export type ChatSessionSummary = ChatSessionMeta & {
  id: string;
  filename: string;
  wikiPath: string;
  turnCount: number;
  lastAt: string | null;
};

function validatedUnitPath(modelRoot: string, unitPath: string): string {
  const normalized = normalizeUnitPath(unitPath);
  resolveModelPath(modelRoot, normalized);
  return normalized;
}

function safeChatFilename(filename: string): string {
  const base = path.basename(filename);
  if (!base || base !== filename || !/^chat-[^/]+\.md$/.test(base)) {
    throw new ModelFsError("Invalid chat session filename", 400);
  }
  return base;
}

function chatSessionId(startedAt: string): string {
  return startedAt.replace(/[:.]/g, "-");
}

function chatSessionFilename(id: string): string {
  return `chat-${id}.md`;
}

function chatSessionDir(modelRoot: string, unitPath: string): string {
  const wikiRoot = wikiRootFromUnitPath(normalizeUnitPath(unitPath));
  return path.join(modelRoot, wikiRoot, "notes", "sessions");
}

function chatSessionWikiPath(unitPath: string, filename: string): string {
  const wikiRoot = wikiRootFromUnitPath(normalizeUnitPath(unitPath));
  return `${wikiRoot}/notes/sessions/${filename}`;
}

function formatTurnHeading(turn: ChatTurn): string {
  const parsed = new Date(turn.at);
  const time = Number.isNaN(parsed.getTime()) ? turn.at : parsed.toISOString().slice(11, 19);
  return `## ${turn.role} · ${time}`;
}

function serializeTurn(turn: ChatTurn): string {
  return `${formatTurnHeading(turn)}\n${turn.text.trim()}\n`;
}

function frontmatterFromMeta(meta: ChatSessionMeta): Record<string, unknown> {
  const data: Record<string, unknown> = {
    kind: "chat",
    provider: meta.provider,
    mode: meta.mode,
    startedAt: meta.startedAt,
    unitPath: meta.unitPath,
  };
  if (meta.terminalSessionId) data.terminalSessionId = meta.terminalSessionId;
  if (meta.agentSessionId) data.agentSessionId = meta.agentSessionId;
  if (meta.contextFiles?.length) data.contextFiles = meta.contextFiles;
  return data;
}

function metaFromFrontmatter(data: Record<string, unknown>, fallbackUnitPath: string): ChatSessionMeta {
  return {
    provider: typeof data.provider === "string" ? data.provider : "unknown",
    mode: data.mode === "bridged" ? "bridged" : "pty",
    startedAt: typeof data.startedAt === "string" ? data.startedAt : "",
    unitPath: typeof data.unitPath === "string" ? data.unitPath : fallbackUnitPath,
    terminalSessionId: typeof data.terminalSessionId === "string" ? data.terminalSessionId : undefined,
    agentSessionId: typeof data.agentSessionId === "string" ? data.agentSessionId : undefined,
    contextFiles: Array.isArray(data.contextFiles) ? data.contextFiles.map(String) : undefined,
  };
}

const TURN_HEADING_RE = /^## (user|assistant) · (.+)$/;

function parseTurns(body: string): ChatTurn[] {
  const lines = body.split("\n");
  const turns: ChatTurn[] = [];
  let current: { role: ChatRole; time: string; textLines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    turns.push({
      role: current.role,
      text: current.textLines.join("\n").trim(),
      at: current.time,
    });
    current = null;
  };

  for (const line of lines) {
    const match = TURN_HEADING_RE.exec(line);
    if (match) {
      flush();
      current = { role: match[1] as ChatRole, time: match[2], textLines: [] };
      continue;
    }
    if (current) current.textLines.push(line);
  }
  flush();

  return turns;
}

export async function createChatSession(
  modelRoot: string,
  unitPath: string,
  meta: Omit<ChatSessionMeta, "unitPath" | "startedAt"> & { startedAt?: string },
): Promise<ChatSessionFile> {
  const normalizedUnit = validatedUnitPath(modelRoot, unitPath);
  const startedAt = meta.startedAt ?? new Date().toISOString();
  const id = chatSessionId(startedAt);
  const filename = chatSessionFilename(id);
  const dir = chatSessionDir(modelRoot, normalizedUnit);
  await mkdir(dir, { recursive: true });

  const fullMeta: ChatSessionMeta = { ...meta, startedAt, unitPath: normalizedUnit };
  const abs = path.join(dir, filename);
  await writeFile(abs, matter.stringify("\n", frontmatterFromMeta(fullMeta)), "utf8");

  return {
    ...fullMeta,
    id,
    filename,
    wikiPath: chatSessionWikiPath(normalizedUnit, filename),
    turns: [],
  };
}

export async function appendChatTurn(
  modelRoot: string,
  unitPath: string,
  filename: string,
  turn: ChatTurn,
): Promise<void> {
  const normalizedUnit = validatedUnitPath(modelRoot, unitPath);
  const safeName = safeChatFilename(filename);
  const abs = path.join(chatSessionDir(modelRoot, normalizedUnit), safeName);
  if (!existsSync(abs)) {
    throw new ModelFsError("Chat session not found", 404);
  }
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const nextBody = `${parsed.content.trimEnd()}\n\n${serializeTurn(turn)}`.replace(/^\n+/, "\n");
  await writeFile(abs, matter.stringify(nextBody, parsed.data), "utf8");
}

/** Union new context file paths into a session's frontmatter (Stage 5 — attach-files control). */
export async function addChatSessionContextFiles(
  modelRoot: string,
  unitPath: string,
  filename: string,
  paths: string[],
): Promise<string[]> {
  const normalizedUnit = validatedUnitPath(modelRoot, unitPath);
  const safeName = safeChatFilename(filename);
  const abs = path.join(chatSessionDir(modelRoot, normalizedUnit), safeName);
  if (!existsSync(abs)) {
    throw new ModelFsError("Chat session not found", 404);
  }
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const meta = metaFromFrontmatter(parsed.data, normalizedUnit);
  const merged = [...new Set([...(meta.contextFiles ?? []), ...paths])];
  const nextMeta: ChatSessionMeta = { ...meta, contextFiles: merged };
  await writeFile(abs, matter.stringify(parsed.content, frontmatterFromMeta(nextMeta)), "utf8");
  return merged;
}

export async function readChatSession(
  modelRoot: string,
  unitPath: string,
  filename: string,
): Promise<ChatSessionFile> {
  const normalizedUnit = validatedUnitPath(modelRoot, unitPath);
  const safeName = safeChatFilename(filename);
  const abs = path.join(chatSessionDir(modelRoot, normalizedUnit), safeName);
  if (!existsSync(abs)) {
    throw new ModelFsError("Chat session not found", 404);
  }
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);
  const meta = metaFromFrontmatter(parsed.data, normalizedUnit);
  const id = safeName.replace(/^chat-/, "").replace(/\.md$/, "");

  return {
    ...meta,
    id,
    filename: safeName,
    wikiPath: chatSessionWikiPath(normalizedUnit, safeName),
    turns: parseTurns(parsed.content),
  };
}

export async function listChatSessions(
  modelRoot: string,
  unitPath: string,
): Promise<ChatSessionSummary[]> {
  const normalizedUnit = validatedUnitPath(modelRoot, unitPath);
  const dir = chatSessionDir(modelRoot, normalizedUnit);
  if (!existsSync(dir)) return [];

  const files = (await readdir(dir)).filter((name) => /^chat-.+\.md$/.test(name)).sort().reverse();
  const summaries: ChatSessionSummary[] = [];

  for (const filename of files) {
    try {
      const raw = await readFile(path.join(dir, filename), "utf8");
      const parsed = matter(raw);
      if (parsed.data.kind !== "chat") continue;
      const meta = metaFromFrontmatter(parsed.data, normalizedUnit);
      const turns = parseTurns(parsed.content);
      const id = filename.replace(/^chat-/, "").replace(/\.md$/, "");
      summaries.push({
        ...meta,
        id,
        filename,
        wikiPath: chatSessionWikiPath(normalizedUnit, filename),
        turnCount: turns.length,
        lastAt: turns.length > 0 ? turns[turns.length - 1].at : null,
      });
    } catch {
      // skip unreadable session files
    }
  }

  return summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
