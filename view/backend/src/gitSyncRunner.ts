import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitSyncState = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput: string | null;
  conflictDetected: boolean;
  pendingStashRestore: boolean;
  viewChangesBlocked: boolean;
};

export function createGitSyncRunner(repoRoot: string, gitSyncEnabled: boolean) {
  const state: GitSyncState = {
    enabled: gitSyncEnabled,
    running: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastOutput: null,
    conflictDetected: false,
    pendingStashRestore: false,
    viewChangesBlocked: false,
  };

  async function git(args: string[]) {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join("\n").trim();
  }

  async function runGitSync(reason = "interval"): Promise<GitSyncState> {
    if (!gitSyncEnabled || state.running) {
      return state;
    }

    state.running = true;
    state.lastRunAt = new Date().toISOString();
    state.lastError = null;
    state.pendingStashRestore = false;
    state.viewChangesBlocked = false;

    let stashCreated = false;

    try {
      const output: string[] = [`sync reason: ${reason}`];
      const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
      output.push(await git(["fetch", "origin"]));

      const modelStatus = await git(["status", "--porcelain", "--", "model"]);
      if (modelStatus) {
        output.push(await git(["add", "model"]));
        output.push(await git(["commit", "-m", "Automated sync"]));
      }

      const outsideModelView = await git([
        "status",
        "--porcelain",
        "--",
        ".",
        ":!model",
        ":!model/**",
        ":!view",
        ":!view/**",
      ]);
      if (outsideModelView) {
        output.push(
          await git([
            "stash",
            "push",
            "-m",
            "treewriter-sync-wip",
            "--",
            ".",
            ":!model",
            ":!model/**",
            ":!view",
            ":!view/**",
          ]),
        );
        stashCreated = true;
      }

      let remoteBranchExists = false;
      try {
        await git(["rev-parse", "--verify", "--quiet", `origin/${branch}`]);
        remoteBranchExists = true;
      } catch {
        remoteBranchExists = false;
      }

      if (remoteBranchExists) {
        try {
          output.push(await git(["rebase", `origin/${branch}`]));
          state.conflictDetected = false;
        } catch (rebaseError) {
          await git(["rebase", "--abort"]).catch(() => {});
          const rebaseMessage =
            rebaseError instanceof Error ? rebaseError.message : String(rebaseError);
          const blockedByLocalChanges = /unstaged changes|uncommitted/i.test(rebaseMessage);
          if (!blockedByLocalChanges) {
            state.conflictDetected = true;
          } else {
            state.viewChangesBlocked = true;
          }
          throw new Error(
            blockedByLocalChanges
              ? "Sync paused — local view/ changes prevented rebase; model/ was committed. Commit view/ or sync manually."
              : "Rebase conflict — aborted; resolve manually in the terminal, then run sync again.",
          );
        }
      } else {
        state.conflictDetected = false;
      }

      output.push(await git(["push", "origin", `HEAD:${branch}`]));

      if (stashCreated) {
        try {
          output.push(await git(["stash", "pop"]));
          stashCreated = false;
        } catch (popError) {
          const message = popError instanceof Error ? popError.message : String(popError);
          output.push(`stash pop failed: ${message}`);
          state.pendingStashRestore = true;
          state.lastError =
            "Model synced, but local view/ edits were left in git stash. In the repo root run: git stash pop";
        }
      }

      state.lastSuccessAt = new Date().toISOString();
      state.lastOutput = output.filter(Boolean).join("\n");
    } catch (error) {
      if (stashCreated) {
        try {
          await git(["stash", "pop"]);
        } catch {
          state.pendingStashRestore = true;
          state.lastError =
            "Sync failed and local view/ edits may still be in git stash. In the repo root run: git stash pop";
        }
      }
      if (!state.lastError) {
        state.lastError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      state.running = false;
    }

    return state;
  }

  return { state, runGitSync };
}
