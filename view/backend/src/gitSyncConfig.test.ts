import path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_COMMIT_PATHS,
  DEFAULT_EXCLUDE_PATHS,
  expandPathspecs,
  loadGitSyncConfig,
  otherRepoPathspecs,
} from "./gitSyncConfig.js";

let repoRoot: string;
const originalCommitEnv = process.env.GIT_SYNC_COMMIT_PATHS;
const originalExcludeEnv = process.env.GIT_SYNC_EXCLUDE_PATHS;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-gitsync-"));
  delete process.env.GIT_SYNC_COMMIT_PATHS;
  delete process.env.GIT_SYNC_EXCLUDE_PATHS;
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
  if (originalCommitEnv === undefined) delete process.env.GIT_SYNC_COMMIT_PATHS;
  else process.env.GIT_SYNC_COMMIT_PATHS = originalCommitEnv;
  if (originalExcludeEnv === undefined) delete process.env.GIT_SYNC_EXCLUDE_PATHS;
  else process.env.GIT_SYNC_EXCLUDE_PATHS = originalExcludeEnv;
});

describe("expandPathspecs", () => {
  it("adds recursive globs for each folder", () => {
    expect(expandPathspecs(["model", "view"])).toEqual(["model", "model/**", "view", "view/**"]);
  });
});

describe("otherRepoPathspecs", () => {
  it("negates commit and exclude folders from repo root", () => {
    expect(otherRepoPathspecs(["model"], ["view"])).toEqual([
      ".",
      ":!model",
      ":!model/**",
      ":!view",
      ":!view/**",
    ]);
  });
});

describe("loadGitSyncConfig", () => {
  it("returns defaults when config file is absent", async () => {
    const config = await loadGitSyncConfig(repoRoot);
    expect(config.commitPaths).toEqual(DEFAULT_COMMIT_PATHS);
    expect(config.excludePaths).toEqual(DEFAULT_EXCLUDE_PATHS);
  });

  it("reads commitPaths and excludePaths from .treewriter.json", async () => {
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      JSON.stringify({
        gitSync: { commitPaths: ["model", "exports"], excludePaths: ["view", "scripts"] },
      }),
      "utf8",
    );
    const config = await loadGitSyncConfig(repoRoot);
    expect(config.commitPaths).toEqual(["model", "exports"]);
    expect(config.excludePaths).toEqual(["view", "scripts"]);
  });

  it("env vars override file config", async () => {
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      JSON.stringify({ gitSync: { commitPaths: ["model"], excludePaths: ["view"] } }),
      "utf8",
    );
    process.env.GIT_SYNC_COMMIT_PATHS = "data";
    process.env.GIT_SYNC_EXCLUDE_PATHS = "view,tmp";
    const config = await loadGitSyncConfig(repoRoot);
    expect(config.commitPaths).toEqual(["data"]);
    expect(config.excludePaths).toEqual(["view", "tmp"]);
  });

  it("reads autoSync from .treewriter.json", async () => {
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      JSON.stringify({ gitSync: { autoSync: false } }),
      "utf8",
    );
    const config = await loadGitSyncConfig(repoRoot);
    expect(config.autoSync).toBe(false);
  });
});
