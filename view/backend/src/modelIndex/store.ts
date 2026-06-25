import path from "node:path";
import { mkdirSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { resolveModelPath, toRelative } from "../modelFs.js";
import type { SearchHit } from "../search.js";
import { buildFtsMatch } from "./ftsQuery.js";
import { indexDbPathForModelRoot } from "./paths.js";

const SCHEMA_VERSION = "1";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  mtime_ms INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS line_fts USING fts5(
  path UNINDEXED,
  line_no UNINDEXED,
  body,
  tokenize='unicode61 remove_diacritics 2'
);
`;

async function walkMarkdown(
  absDir: string,
  modelRoot: string,
  acc: string[],
): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(abs, modelRoot, acc);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      acc.push(toRelative(modelRoot, abs));
    }
  }
}

function scopeMatchesPath(rootRel: string, filePath: string): boolean {
  if (!rootRel) return true;
  const root = rootRel.replace(/\\/g, "/").replace(/\/+$/, "");
  return filePath === root || filePath.startsWith(`${root}/`);
}

export class ModelIndexStore {
  private readonly db: DatabaseSync;

  constructor(
    private readonly modelRoot: string,
    dbPath = indexDbPathForModelRoot(modelRoot),
  ) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.initSchema();
  }

  close(): void {
    this.db.close();
  }

  clear(): void {
    this.db.exec("DELETE FROM line_fts;");
    this.db.exec("DELETE FROM files;");
  }

  removeIndexedFile(relPath: string): void {
    this.removeFileIndex(relPath.replace(/\\/g, "/"));
  }

  removeIndexedPathsUnder(folderRel: string): void {
    const prefix = folderRel.replace(/\\/g, "/").replace(/\/+$/, "");
    const rows = this.db.prepare("SELECT path FROM files").all() as Array<{ path: string }>;
    for (const row of rows) {
      if (row.path === prefix || row.path.startsWith(`${prefix}/`)) {
        this.removeFileIndex(row.path);
      }
    }
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      | { value: string }
      | undefined;
    if (!row) {
      this.db.prepare("INSERT INTO meta(key, value) VALUES ('schema_version', ?)").run(SCHEMA_VERSION);
    }
  }

  private removeFileIndex(relPath: string): void {
    const normalized = relPath.replace(/\\/g, "/");
    this.db.prepare("DELETE FROM line_fts WHERE path = ?").run(normalized);
    this.db.prepare("DELETE FROM files WHERE path = ?").run(normalized);
  }

  private indexFile(relPath: string, mtimeMs: number, content: string): void {
    const normalized = relPath.replace(/\\/g, "/");
    this.removeFileIndex(normalized);
    const insert = this.db.prepare(
      "INSERT INTO line_fts(path, line_no, body) VALUES (?, ?, ?)",
    );
    const lines = content.split(/\r?\n/);
    this.db.exec("BEGIN");
    try {
      for (let i = 0; i < lines.length; i += 1) {
        insert.run(normalized, i + 1, lines[i] ?? "");
      }
      this.db
        .prepare("INSERT OR REPLACE INTO files(path, mtime_ms) VALUES (?, ?)")
        .run(normalized, mtimeMs);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async syncScope(rootRel = ""): Promise<void> {
    const rootAbs = resolveModelPath(this.modelRoot, rootRel);
    const diskFiles: string[] = [];
    await walkMarkdown(rootAbs, this.modelRoot, diskFiles);

    const indexed = this.db
      .prepare("SELECT path, mtime_ms FROM files")
      .all() as Array<{ path: string; mtime_ms: number }>;

    for (const row of indexed) {
      if (!scopeMatchesPath(rootRel, row.path)) continue;
      if (!diskFiles.includes(row.path)) {
        this.removeFileIndex(row.path);
      }
    }

    for (const rel of diskFiles.sort()) {
      const abs = resolveModelPath(this.modelRoot, rel);
      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(abs);
      } catch {
        this.removeFileIndex(rel);
        continue;
      }
      const mtimeMs = fileStat.mtimeMs;
      const existing = this.db.prepare("SELECT mtime_ms FROM files WHERE path = ?").get(rel) as
        | { mtime_ms: number }
        | undefined;
      if (existing?.mtime_ms === mtimeMs) continue;

      let content: string;
      try {
        content = await readFile(abs, "utf8");
      } catch {
        this.removeFileIndex(rel);
        continue;
      }
      this.indexFile(rel, mtimeMs, content);
    }
  }

  search(query: string, rootRel = "", limit = 50): SearchHit[] {
    const match = buildFtsMatch(query);
    if (!match) return [];

    const scope = rootRel.replace(/\\/g, "/").replace(/\/+$/, "");
    const stmt = scope
      ? this.db.prepare(
          `SELECT path, line_no, snippet(line_fts, 2, '…', '…', '…', 50) AS excerpt
           FROM line_fts
           WHERE body MATCH ?
             AND (path = ? OR path LIKE ?)
           LIMIT ?`,
        )
      : this.db.prepare(
          `SELECT path, line_no, snippet(line_fts, 2, '…', '…', '…', 50) AS excerpt
           FROM line_fts
           WHERE body MATCH ?
           LIMIT ?`,
        );

    const rows = (
      scope
        ? stmt.all(match, scope, `${scope}/%`, limit)
        : stmt.all(match, limit)
    ) as Array<{ path: string; line_no: number; excerpt: string }>;

    return rows.map((row) => ({
      path: row.path,
      line: row.line_no,
      excerpt: row.excerpt.replace(/\s+/g, " ").trim(),
    }));
  }
}

const stores = new Map<string, ModelIndexStore>();

export function getModelIndexStore(modelRoot: string, dbPath?: string): ModelIndexStore {
  const key = `${modelRoot}\0${dbPath ?? ""}`;
  const existing = stores.get(key);
  if (existing) return existing;
  const store = new ModelIndexStore(modelRoot, dbPath ?? indexDbPathForModelRoot(modelRoot));
  stores.set(key, store);
  return store;
}

export function resetModelIndexStores(): void {
  for (const store of stores.values()) {
    store.close();
  }
  stores.clear();
}

/** Drop indexed rows likely affected by a model path change. */
export function invalidateModelIndexForChange(modelRoot: string, changedPath: string | null): void {
  const store = getModelIndexStore(modelRoot);
  if (!changedPath) {
    store.clear();
    return;
  }
  const normalized = changedPath.replace(/\\/g, "/");
  if (normalized.toLowerCase().endsWith(".md")) {
    store.removeIndexedFile(normalized);
    return;
  }
  store.removeIndexedPathsUnder(normalized);
}
