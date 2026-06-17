import path from "node:path";
import { readFile } from "node:fs/promises";

import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export type GitSyncConfig = {
  /** Git sync feature available (env kill switch). */
  enabled: boolean;
  /** Background interval sync on/off (UI toggle). */
  autoSync: boolean;
  intervalMs: number;
  commitPaths: string[];
  excludePaths: string[];
};

export const DEFAULT_COMMIT_PATHS = ["model"];
export const DEFAULT_EXCLUDE_PATHS = ["view"];

function parseListEnv(name: string): string[] | undefined {
  const value = process.env[name];
  if (!value?.trim()) return undefined;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizePathSegment(segment: string): string {
  return segment.replace(/\\/g, "/").replace(/\/+$/, "") || ".";
}

/** Git pathspecs for status/add/stash on configured folders. */
export function expandPathspecs(paths: string[]): string[] {
  const out = new Set<string>();
  for (const raw of paths) {
    const normalized = normalizePathSegment(raw);
    out.add(normalized);
    if (normalized !== ".") {
      out.add(`${normalized}/**`);
    }
  }
  return [...out];
}

/** Pathspecs for "everything except these folders" (repo root + negations). */
export function otherRepoPathspecs(commitPaths: string[], excludePaths: string[]): string[] {
  const skip = new Set([...commitPaths, ...excludePaths].map(normalizePathSegment));
  const negations = expandPathspecs([...skip]).map((spec) => `:!${spec}`);
  return [".", ...negations];
}

export async function loadGitSyncConfig(repoRoot: string): Promise<GitSyncConfig> {
  const enabled = process.env.GIT_SYNC_ENABLED !== "false";
  const intervalMs = Number(process.env.GIT_SYNC_INTERVAL_MS ?? 120_000);
  let autoSync = process.env.GIT_SYNC_AUTO !== "false";
  let commitPaths = [...DEFAULT_COMMIT_PATHS];
  let excludePaths = [...DEFAULT_EXCLUDE_PATHS];

  try {
    const raw = await readFile(path.join(repoRoot, ".treewriter.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      gitSync?: {
        autoSync?: boolean;
        commitPaths?: string[];
        excludePaths?: string[];
      };
    };
    if (typeof parsed.gitSync?.autoSync === "boolean") {
      autoSync = parsed.gitSync.autoSync;
    }
    if (Array.isArray(parsed.gitSync?.commitPaths) && parsed.gitSync.commitPaths.length > 0) {
      commitPaths = parsed.gitSync.commitPaths;
    }
    if (Array.isArray(parsed.gitSync?.excludePaths) && parsed.gitSync.excludePaths.length > 0) {
      excludePaths = parsed.gitSync.excludePaths;
    }
  } catch {
    // use defaults
  }

  const envCommit = parseListEnv("GIT_SYNC_COMMIT_PATHS");
  const envExclude = parseListEnv("GIT_SYNC_EXCLUDE_PATHS");
  if (envCommit) commitPaths = envCommit;
  if (envExclude) excludePaths = envExclude;

  return { enabled, autoSync, intervalMs, commitPaths, excludePaths };
}

export async function saveGitSyncPreferences(
  repoRoot: string,
  patch: { autoSync?: boolean },
): Promise<void> {
  const configPath = path.join(repoRoot, ".treewriter.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  const gitSync =
    parsed.gitSync && typeof parsed.gitSync === "object"
      ? { ...(parsed.gitSync as Record<string, unknown>) }
      : {};
  if (patch.autoSync !== undefined) {
    gitSync.autoSync = patch.autoSync;
  }
  parsed.gitSync = gitSync;
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}
