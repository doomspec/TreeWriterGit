import path from "node:path";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import matter from "gray-matter";

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
}

function sessionsDir(modelRoot: string, unitPath: string): string {
  return path.join(modelRoot, unitPath, ".sessions");
}

export async function listSessions(
  modelRoot: string,
  unitPath: string,
): Promise<SessionFile[]> {
  const dir = sessionsDir(modelRoot, unitPath);
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

export async function createSession(
  modelRoot: string,
  unitPath: string,
  record: SessionRecord,
): Promise<string> {
  const dir = sessionsDir(modelRoot, unitPath);
  await mkdir(dir, { recursive: true });

  // filename: YYYYMMDD-HHMMSS.md (ISO timestamp without colons)
  const ts = record.at.replace(/[:.]/g, "-").replace("T", "_").slice(0, 17);
  const filename = `${ts}.md`;
  const filePath = path.join(dir, filename);

  const body = `# ${record.action} — ${record.provider}\n\n_Session dispatched at ${record.at}_\n`;
  const content = matter.stringify(body, {
    at: record.at,
    provider: record.provider,
    action: record.action,
    command: record.command,
    status: record.status,
    ...(record.notes ? { notes: record.notes } : {}),
  });

  await writeFile(filePath, content, "utf8");
  return `${unitPath}/.sessions/${filename}`;
}

export async function updateSessionStatus(
  modelRoot: string,
  unitPath: string,
  filename: string,
  status: SessionFile["status"],
  notes?: string,
): Promise<void> {
  const filePath = path.join(sessionsDir(modelRoot, unitPath), filename);
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const data = { ...parsed.data, status, ...(notes !== undefined ? { notes } : {}) };
  await writeFile(filePath, matter.stringify(parsed.content, data), "utf8");
}
