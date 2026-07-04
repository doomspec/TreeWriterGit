import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function gitHashObject(repoRoot: string, content: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("git", ["-C", repoRoot, "hash-object", "-w", "--stdin"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 && stdout.trim() ? stdout.trim() : null));
    child.stdin.write(content);
    child.stdin.end();
  });
}

export type GitApprovalProvenance = {
  gitCommit: string | null;
  gitFileBlob: string | null;
};

/** Best-effort git provenance at approve time; null when not in a git repo. */
export async function captureGitApprovalProvenance(
  repoRoot: string,
  fileRel: string,
  content: string,
): Promise<GitApprovalProvenance> {
  try {
    const { stdout: headStdout } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8" as BufferEncoding,
    });
    const gitCommit = headStdout.trim() || null;
    let gitFileBlob: string | null = null;
    const blobHash = await gitHashObject(repoRoot, content);
    gitFileBlob = blobHash ? `sha1:${blobHash}` : null;
    void fileRel;
    return { gitCommit, gitFileBlob };
  } catch {
    return { gitCommit: null, gitFileBlob: null };
  }
}
