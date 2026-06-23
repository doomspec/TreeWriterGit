import path from "node:path";
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";

import { ModelFsError, resolveModelPath } from "./modelFs.js";
import {
  appendSessionWikiEntry,
  listSessionWikiEntries,
  sessionIdFromFilename,
  updateSessionWikiEntry,
} from "./sessionWiki.js";

export interface SessionRecord {
  at: string;
  provider: string;
  action: string;
  command: string;
  status: "dispatched" | "complete" | "skipped";
  notes?: string;
}

export interface SessionFile extends SessionRecord {
  filename: string;
  body: string;
  wikiPath?: string;
}

function validatedUnitPath(modelRoot: string, unitPath: string): string {
  const normalized = unitPath.split(path.sep).join("/");
  resolveModelPath(modelRoot, normalized);
  return normalized;
}

function legacySessionsDir(modelRoot: string, unitPath: string): string {
  return path.join(modelRoot, validatedUnitPath(modelRoot, unitPath), ".sessions");
}

function safeSessionFilename(filename: string): string {
  const base = path.basename(filename);
  if (!base || base !== filename || !base.endsWith(".md")) {
    throw new ModelFsError("Invalid session filename", 400);
  }
  return base;
}

async function listLegacySessions(
  modelRoot: string,
  unitPath: string,
): Promise<SessionFile[]> {
  const dir = legacySessionsDir(modelRoot, unitPath);
  if (!existsSync(dir)) return [];
  const entries = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort().reverse();
  const sessions: SessionFile[] = [];
  for (const filename of entries) {
    try {
      const raw = await readFile(path.join(dir, filename), "utf8");
      const parsed = matter(raw);
      sessions.push({
        filename,
        body: parsed.content.trim(),
        at: String(parsed.data.at ?? ""),
        provider: String(parsed.data.provider ?? ""),
        action: String(parsed.data.action ?? ""),
        command: String(parsed.data.command ?? ""),
        status: (parsed.data.status as SessionFile["status"]) ?? "dispatched",
        notes: parsed.data.notes ? String(parsed.data.notes) : undefined,
      });
    } catch {
      // skip unreadable session files
    }
  }
  return sessions;
}

export async function listSessions(
  modelRoot: string,
  unitPath: string,
): Promise<SessionFile[]> {
  validatedUnitPath(modelRoot, unitPath);

  const wikiSessions = (await listSessionWikiEntries(modelRoot, unitPath)).map((entry) => ({
    filename: entry.filename,
    wikiPath: entry.wikiPath,
    body: entry.body,
    at: entry.at,
    provider: entry.provider,
    action: entry.action,
    command: entry.command,
    status: entry.status,
    notes: entry.notes,
  }));

  const legacySessions = await listLegacySessions(modelRoot, unitPath);
  const seen = new Set(wikiSessions.map((session) => session.filename));
  const merged: SessionFile[] = [...wikiSessions];

  for (const session of legacySessions) {
    if (seen.has(session.filename)) continue;
    merged.push({
      ...session,
      wikiPath: session.wikiPath ?? `${unitPath}/notes/sessions/${session.filename}`,
    });
  }

  return merged.sort((a, b) => b.at.localeCompare(a.at));
}

export async function createSession(
  modelRoot: string,
  unitPath: string,
  record: SessionRecord,
): Promise<string> {
  const normalized = validatedUnitPath(modelRoot, unitPath);
  const created = await appendSessionWikiEntry(modelRoot, normalized, {
    at: record.at,
    provider: record.provider,
    action: record.action,
    command: record.command,
    status: record.status,
    notes: record.notes,
  });
  return created.wikiPath;
}

async function updateLegacySessionStatus(
  modelRoot: string,
  unitPath: string,
  filename: string,
  status: SessionFile["status"],
  notes?: string,
): Promise<boolean> {
  try {
    const safeName = safeSessionFilename(filename);
    const filePath = path.join(legacySessionsDir(modelRoot, unitPath), safeName);
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const data = { ...parsed.data, status, ...(notes !== undefined ? { notes } : {}) };
    await writeFile(filePath, matter.stringify(parsed.content, data), "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function updateSessionStatus(
  modelRoot: string,
  unitPath: string,
  filename: string,
  status: SessionFile["status"],
  notes?: string,
): Promise<void> {
  validatedUnitPath(modelRoot, unitPath);
  const sessionId = sessionIdFromFilename(safeSessionFilename(filename));
  const updated = await updateSessionWikiEntry(modelRoot, unitPath, sessionId, status, notes);
  if (updated) return;

  const legacyUpdated = await updateLegacySessionStatus(modelRoot, unitPath, filename, status, notes);
  if (!legacyUpdated) {
    throw new ModelFsError("Session not found", 404);
  }
}

/** Bump unit status to drafted when a draft/revise/expand session completes. */
export async function advanceUnitStatusOnSessionComplete(
  modelRoot: string,
  unitPath: string,
  action: string,
): Promise<void> {
  if (!["draft", "revise", "expand", "cite-check"].includes(action)) return;
  const normalized = validatedUnitPath(modelRoot, unitPath);
  const indexAbs = path.join(modelRoot, normalized, "INDEX.md");
  if (!existsSync(indexAbs)) return;
  const raw = await readFile(indexAbs, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  if (data.kind !== "unit") return;
  const current = String(data.status ?? "outline");
  if (current === "approved") return;
  if (current === "outline" || current === "draft" || current === "drafted") {
    await writeFile(
      indexAbs,
      matter.stringify(parsed.content, { ...data, status: "drafted" }),
      "utf8",
    );
  }
}

export async function deleteSessionPrompt(repoRoot: string, sessionId: string): Promise<void> {
  const safeId = path.basename(sessionId);
  if (!safeId || safeId !== sessionId) return;
  const promptPath = path.join(repoRoot, ".treewriter-prompts", `${safeId}.txt`);
  if (existsSync(promptPath)) {
    await rm(promptPath, { force: true });
  }
}
