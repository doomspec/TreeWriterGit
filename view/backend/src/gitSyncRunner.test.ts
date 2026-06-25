import { describe, it, expect, vi, beforeEach } from "vitest";

const { execFileMock } = vi.hoisted(() => {
  const mock = vi.fn();
  const customPromisify = Symbol.for("nodejs.util.promisify.custom");
  Object.defineProperty(mock, customPromisify, {
    value: (
      file: string,
      args: string[],
      options: Record<string, unknown>,
    ) =>
      new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        mock(
          file,
          args,
          options,
          (error: Error | null, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          },
        );
      }),
  });
  return { execFileMock: mock };
});

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { createGitSyncRunner } from "./gitSyncRunner.js";
import { expandPathspecs, otherRepoPathspecs } from "./gitSyncConfig.js";

type GitResult = { stdout?: string; stderr?: string; error?: Error };

function invokeCallback(
  optionsOrCb: unknown,
  maybeCb: unknown,
  error: Error | null,
  stdout: string,
  stderr: string,
) {
  const callback =
    typeof optionsOrCb === "function"
      ? optionsOrCb
      : (maybeCb as (err: Error | null, stdout: string, stderr: string) => void);
  callback(error, stdout, stderr);
}

function mockGit(handler: (args: string[]) => GitResult | undefined) {
  execFileMock.mockImplementation(
    (_file: string, args: string[], optionsOrCb: unknown, maybeCb?: unknown) => {
      const result = handler(args as string[]);
      if (!result) {
        invokeCallback(optionsOrCb, maybeCb, null, "", "");
        return;
      }
      invokeCallback(
        optionsOrCb,
        maybeCb,
        result.error ?? null,
        result.stdout ?? "",
        result.stderr ?? "",
      );
    },
  );
}

function isCommitStatus(args: string[], commitPaths: string[]): boolean {
  if (args[0] !== "status" || args[1] !== "--porcelain" || args[2] !== "--") return false;
  const pathspecs = args.slice(3);
  const commitSpecs = expandPathspecs(commitPaths);
  return (
    pathspecs.length === commitSpecs.length &&
    pathspecs.every((spec, index) => spec === commitSpecs[index])
  );
}

function isOutsideStatus(args: string[], commitPaths: string[], excludePaths: string[]): boolean {
  if (args[0] !== "status" || args[1] !== "--porcelain" || args[2] !== "--") return false;
  const pathspecs = args.slice(3);
  const outsideSpecs = otherRepoPathspecs(commitPaths, excludePaths);
  return (
    pathspecs.length === outsideSpecs.length &&
    pathspecs.every((spec, index) => spec === outsideSpecs[index])
  );
}

function defaultHappyPath(options: {
  branch?: string;
  commitPaths?: string[];
  excludePaths?: string[];
  commitStatus?: string;
  outsideStatus?: string;
  remoteBranchExists?: boolean;
} = {}) {
  const branch = options.branch ?? "main";
  const commitPaths = options.commitPaths ?? ["model"];
  const excludePaths = options.excludePaths ?? ["view"];
  const commitStatus = options.commitStatus ?? "";
  const outsideStatus = options.outsideStatus ?? "";
  const remoteBranchExists = options.remoteBranchExists ?? true;

  return (args: string[]): GitResult | undefined => {
    const [cmd, ...rest] = args;
    if (cmd === "rev-parse" && rest[0] === "--abbrev-ref") {
      return { stdout: `${branch}\n` };
    }
    if (cmd === "fetch") return { stdout: "" };
    if (isCommitStatus(args, commitPaths)) return { stdout: commitStatus };
    if (isOutsideStatus(args, commitPaths, excludePaths)) return { stdout: outsideStatus };
    if (cmd === "add" || cmd === "commit" || cmd === "stash" || cmd === "push") {
      return { stdout: "" };
    }
    if (cmd === "rebase" && rest[0] !== "--abort") return { stdout: "" };
    if (cmd === "rebase" && rest[0] === "--abort") return { stdout: "" };
    if (cmd === "rev-parse" && rest[0] === "--verify") {
      if (remoteBranchExists) return { stdout: "" };
      return { error: new Error("fatal: Needed a single revision") };
    }
    return undefined;
  };
}

const repoRoot = "/tmp/tw-repo";

describe("createGitSyncRunner", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("uses custom commitPaths for status, add, and commit", async () => {
    const commitPaths = ["papers", "exports"];
    const commitSpecs = expandPathspecs(commitPaths);

    mockGit(
      defaultHappyPath({
        branch: "feature/custom",
        commitPaths,
        excludePaths: ["view"],
        commitStatus: " M papers/foo.md",
      }),
    );

    const { runGitSync } = createGitSyncRunner(repoRoot, true, async () => ({
      enabled: true,
      autoSync: true,
      intervalMs: 120_000,
      commitPaths,
      excludePaths: ["view"],
    }));

    const state = await runGitSync("test");

    expect(state.lastError).toBeNull();
    expect(state.lastSuccessAt).not.toBeNull();

    const addCall = execFileMock.mock.calls.find(([, args]) => (args as string[])[0] === "add");
    expect(addCall?.[1]).toEqual(["add", "--", ...commitSpecs]);

    const commitCall = execFileMock.mock.calls.find(([, args]) => (args as string[])[0] === "commit");
    expect(commitCall?.[1]).toEqual(["commit", "-m", "Automated sync"]);
  });

  it("sets pendingStashRestore when stash pop fails after a successful push", async () => {
    mockGit((args) => {
      if (args[0] === "stash" && args[1] === "pop") {
        return { error: new Error("error: Your local changes would be overwritten by merge") };
      }
      return defaultHappyPath({
        outsideStatus: " M scripts/tweak.sh",
      })(args);
    });

    const { runGitSync } = createGitSyncRunner(repoRoot, true, async () => ({
      enabled: true,
      autoSync: true,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }));

    const state = await runGitSync("test");

    expect(state.pendingStashRestore).toBe(true);
    expect(state.lastSuccessAt).not.toBeNull();
    expect(state.lastError).toMatch(/git stash pop/i);
  });

  it("sets conflictDetected when rebase fails with a merge conflict", async () => {
    mockGit((args) => {
      if (args[0] === "rebase" && args[1] !== "--abort") {
        return { error: new Error("error: could not apply abc1234... CONFLICT (content)") };
      }
      return defaultHappyPath()(args);
    });

    const { runGitSync } = createGitSyncRunner(repoRoot, true, async () => ({
      enabled: true,
      autoSync: true,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }));

    const state = await runGitSync("test");

    expect(state.conflictDetected).toBe(true);
    expect(state.viewChangesBlocked).toBe(false);
    expect(state.lastError).toMatch(/Rebase conflict/i);
    expect(state.lastSuccessAt).toBeNull();

    const abortCall = execFileMock.mock.calls.find(
      ([, args]) => (args as string[])[0] === "rebase" && (args as string[])[1] === "--abort",
    );
    expect(abortCall).toBeDefined();
  });

  it("sets viewChangesBlocked when rebase fails due to unstaged local changes", async () => {
    mockGit((args) => {
      if (args[0] === "rebase" && args[1] !== "--abort") {
        return {
          error: new Error(
            "error: cannot rebase: You have unstaged changes.",
          ),
        };
      }
      return defaultHappyPath()(args);
    });

    const { runGitSync } = createGitSyncRunner(repoRoot, true, async () => ({
      enabled: true,
      autoSync: true,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }));

    const state = await runGitSync("test");

    expect(state.viewChangesBlocked).toBe(true);
    expect(state.conflictDetected).toBe(false);
    expect(state.lastError).toMatch(/local changes outside commit paths/i);
    expect(state.lastSuccessAt).toBeNull();
  });

  it("skips sync when disabled and does not invoke git", async () => {
    const { runGitSync } = createGitSyncRunner(repoRoot, false, async () => ({
      enabled: false,
      autoSync: false,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }));

    const state = await runGitSync("test");

    expect(state.enabled).toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
