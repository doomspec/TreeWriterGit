import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import { paperRootFromPath } from "./trash.js";

export type SessionWikiStatus = "dispatched" | "complete" | "skipped";

export type SessionWikiEntry = {
  id: string;
  at: string;
  unitPath: string;
  provider: string;
  action: string;
  command: string;
  status: SessionWikiStatus;
  notes?: string;
};

export type SessionWikiRecord = SessionWikiEntry & {
  filename: string;
  wikiPath: string;
  body: string;
};

const SESSION_BLOCK_RE =
  /<!-- tw-session\n([\s\S]*?)\n-->\n\n([\s\S]*?)(?=\n---\n|\n<!-- tw-session\n|$)/g;

function wikiRootFromUnitPath(unitPath: string): string {
  const paper = paperRootFromPath(unitPath);
  if (paper) return paper;
  const first = unitPath.split("/").filter(Boolean)[0];
  return first ?? unitPath;
}

function normalizeUnitPath(unitPath: string): string {
  return unitPath.split(path.sep).join("/").replace(/^\/+|\/+$/g, "");
}

export function sessionIdFromAt(at: string): string {
  return at.replace(/[:.]/g, "-").replace("T", "_");
}

export function sessionFilenameFromId(id: string): string {
  return `${id}.md`;
}

export function sessionIdFromFilename(filename: string): string {
  const base = path.basename(filename);
  return base.replace(/\.md$/i, "");
}

function dateFromAt(at: string): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function formatWikiTime(at: string): string {
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return at;
  return parsed.toISOString().slice(11, 19);
}

function relativeUnitWikilink(unitPath: string, wikiRoot: string): string {
  const normalized = normalizeUnitPath(unitPath);
  const root = normalizeUnitPath(wikiRoot);
  const relative =
    normalized === root
      ? "."
      : normalized.startsWith(`${root}/`)
        ? normalized.slice(root.length + 1)
        : normalized;
  const indexTarget = relative === "." ? "INDEX" : `${relative}/INDEX`;
  const label = relative.split("/").pop() ?? relative;
  return `[[${indexTarget}|${label}]]`;
}

function parseSessionMeta(raw: string): Partial<SessionWikiEntry> {
  const meta: Partial<SessionWikiEntry> = {};
  let commandLines: string[] | null = null;

  for (const line of raw.split("\n")) {
    if (commandLines) {
      if (line.startsWith("  ")) {
        commandLines.push(line.slice(2));
        continue;
      }
      meta.command = commandLines.join("\n");
      commandLines = null;
    }

    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (key === "command" && value === "|") {
      commandLines = [];
      continue;
    }
    if (key === "id") meta.id = value;
    if (key === "at") meta.at = value;
    if (key === "unit") meta.unitPath = value;
    if (key === "provider") meta.provider = value;
    if (key === "action") meta.action = value;
    if (key === "status") meta.status = value as SessionWikiStatus;
    if (key === "notes") meta.notes = value;
  }

  if (commandLines) {
    meta.command = commandLines.join("\n");
  }

  return meta;
}

function serializeSessionMeta(entry: SessionWikiEntry): string {
  const lines = [
    `id: ${entry.id}`,
    `at: ${entry.at}`,
    `unit: ${entry.unitPath}`,
    `provider: ${entry.provider}`,
    `action: ${entry.action}`,
    `status: ${entry.status}`,
  ];
  if (entry.notes) lines.push(`notes: ${entry.notes}`);
  lines.push("command: |");
  for (const line of entry.command.split("\n")) {
    lines.push(`  ${line}`);
  }
  return lines.join("\n");
}

function formatSessionBlock(entry: SessionWikiEntry, wikiRoot: string): string {
  const unitShort = normalizeUnitPath(entry.unitPath).split("/").pop() ?? entry.unitPath;
  const wikilink = relativeUnitWikilink(entry.unitPath, wikiRoot);
  const heading = `## ${formatWikiTime(entry.at)} · ${entry.action} · ${entry.provider} · ${wikilink}`;

  return `<!-- tw-session
${serializeSessionMeta(entry)}
-->

${heading}

**Unit:** \`${normalizeUnitPath(entry.unitPath)}\`  
**Status:** ${entry.status}

\`\`\`bash
${entry.command}
\`\`\`

---
`;
}

function wikiDayRelPath(wikiRoot: string, date: string): string {
  return `${wikiRoot}/notes/sessions/${date}.md`;
}

function parseWikiDayFile(
  wikiPath: string,
  raw: string,
  filterUnitPath?: string,
): SessionWikiRecord[] {
  const parsed = matter(raw);
  const records: SessionWikiRecord[] = [];
  const content = parsed.content.trimStart();
  const filter = filterUnitPath ? normalizeUnitPath(filterUnitPath) : null;

  for (const match of content.matchAll(SESSION_BLOCK_RE)) {
    const meta = parseSessionMeta(match[1]);
    if (!meta.id || !meta.at || !meta.unitPath) continue;
    const normalizedUnit = normalizeUnitPath(meta.unitPath);
    if (filter && normalizedUnit !== filter) continue;

    records.push({
      id: meta.id,
      at: meta.at,
      unitPath: normalizedUnit,
      provider: String(meta.provider ?? ""),
      action: String(meta.action ?? ""),
      command: String(meta.command ?? ""),
      status: (meta.status as SessionWikiStatus) ?? "dispatched",
      notes: meta.notes ? String(meta.notes) : undefined,
      filename: sessionFilenameFromId(meta.id),
      wikiPath,
      body: match[2].trim(),
    });
  }

  return records;
}

async function ensureWikiDayFile(
  modelRoot: string,
  wikiRoot: string,
  date: string,
): Promise<string> {
  const rel = wikiDayRelPath(wikiRoot, date);
  const abs = path.join(modelRoot, rel);
  await mkdir(path.dirname(abs), { recursive: true });

  if (!existsSync(abs)) {
    const content = matter.stringify(
      `\n# AI dispatch log — ${date}\n\n`,
      {
        kind: "llm-wiki-day",
        date,
        paper: wikiRoot.startsWith("papers/") ? wikiRoot : undefined,
        root: wikiRoot,
      },
    );
    await writeFile(abs, content, "utf8");
  }

  return rel;
}

export async function appendSessionWikiEntry(
  modelRoot: string,
  unitPath: string,
  entry: Omit<SessionWikiEntry, "id" | "unitPath"> & { id?: string },
): Promise<{ wikiPath: string; id: string; filename: string }> {
  const normalizedUnit = normalizeUnitPath(unitPath);
  const wikiRoot = wikiRootFromUnitPath(normalizedUnit);
  const id = entry.id ?? sessionIdFromAt(entry.at);
  const date = dateFromAt(entry.at);
  const wikiPath = await ensureWikiDayFile(modelRoot, wikiRoot, date);
  const abs = path.join(modelRoot, wikiPath);
  const raw = await readFile(abs, "utf8");
  const parsed = matter(raw);

  const fullEntry: SessionWikiEntry = {
    id,
    at: entry.at,
    unitPath: normalizedUnit,
    provider: entry.provider,
    action: entry.action,
    command: entry.command,
    status: entry.status,
    notes: entry.notes,
  };

  const block = formatSessionBlock(fullEntry, wikiRoot);
  const nextBody = parsed.content.trimEnd() + (parsed.content.trim() ? "\n\n" : "\n") + block;
  await writeFile(abs, matter.stringify(nextBody, parsed.data), "utf8");

  return { wikiPath, id, filename: sessionFilenameFromId(id) };
}

export async function listSessionWikiEntries(
  modelRoot: string,
  unitPath: string,
): Promise<SessionWikiRecord[]> {
  const normalizedUnit = normalizeUnitPath(unitPath);
  const wikiRoot = wikiRootFromUnitPath(normalizedUnit);
  const dir = path.join(modelRoot, wikiRoot, "notes", "sessions");
  if (!existsSync(dir)) return [];

  const files = (await readdir(dir)).filter((name) => name.endsWith(".md")).sort().reverse();
  const records: SessionWikiRecord[] = [];

  for (const name of files) {
    const wikiPath = `${wikiRoot}/notes/sessions/${name}`;
    try {
      const raw = await readFile(path.join(modelRoot, wikiPath), "utf8");
      records.push(...parseWikiDayFile(wikiPath, raw, normalizedUnit));
    } catch {
      // skip unreadable wiki pages
    }
  }

  return records.sort((a, b) => b.at.localeCompare(a.at));
}

export async function updateSessionWikiEntry(
  modelRoot: string,
  unitPath: string,
  sessionId: string,
  status: SessionWikiStatus,
  notes?: string,
): Promise<SessionWikiEntry | null> {
  const normalizedUnit = normalizeUnitPath(unitPath);
  const wikiRoot = wikiRootFromUnitPath(normalizedUnit);
  const dir = path.join(modelRoot, wikiRoot, "notes", "sessions");
  if (!existsSync(dir)) return null;

  const files = (await readdir(dir)).filter((name) => name.endsWith(".md")).sort().reverse();

  for (const name of files) {
    const wikiPath = `${wikiRoot}/notes/sessions/${name}`;
    const abs = path.join(modelRoot, wikiPath);
    const raw = await readFile(abs, "utf8");
    const parsed = matter(raw);
    const records = parseWikiDayFile(wikiPath, raw);
    const targetIndex = records.findIndex((record) => record.id === sessionId);
    if (targetIndex === -1) continue;

    const target = records[targetIndex];
    const updated: SessionWikiEntry = {
      id: target.id,
      at: target.at,
      unitPath: target.unitPath,
      provider: target.provider,
      action: target.action,
      command: target.command,
      status,
      notes: notes !== undefined ? notes : target.notes,
    };

    const headerMatch = parsed.content.match(/^[\s\S]*?(?=<!-- tw-session\n)/);
    const header = headerMatch?.[0]?.trimEnd() ?? `# AI dispatch log — ${parsed.data.date ?? name.replace(/\.md$/, "")}`;
    const blocks = records.map((record, index) =>
      formatSessionBlock(index === targetIndex ? updated : {
        id: record.id,
        at: record.at,
        unitPath: record.unitPath,
        provider: record.provider,
        action: record.action,
        command: record.command,
        status: record.status,
        notes: record.notes,
      }, wikiRoot).trimEnd(),
    );

    await writeFile(
      abs,
      matter.stringify(`${header}\n\n${blocks.join("\n\n")}\n`, parsed.data),
      "utf8",
    );
    return updated;
  }

  return null;
}
