import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";

import { connectOverleafProject, getOverleafStatus, overleafCloneDir, parseOverleafGitUrl } from "./overleaf.js";

const PROJECT_ID = "6a3b01176b40765de8e0802d";

describe("parseOverleafGitUrl", () => {
  it("accepts bare project ids", () => {
    expect(parseOverleafGitUrl(PROJECT_ID)).toEqual({
      projectId: PROJECT_ID,
      httpsCloneUrl: `https://git.overleaf.com/${PROJECT_ID}`,
    });
  });

  it("accepts https clone urls", () => {
    expect(parseOverleafGitUrl(`https://git.overleaf.com/${PROJECT_ID}`)).toEqual({
      projectId: PROJECT_ID,
      httpsCloneUrl: `https://git.overleaf.com/${PROJECT_ID}`,
    });
  });

  it("accepts malformed https urls with git@ prefix", () => {
    expect(parseOverleafGitUrl(`https://git@git.overleaf.com/${PROJECT_ID}`)).toEqual({
      projectId: PROJECT_ID,
      httpsCloneUrl: `https://git.overleaf.com/${PROJECT_ID}`,
    });
  });

  it("accepts ssh clone urls", () => {
    expect(parseOverleafGitUrl(`git@git.overleaf.com:${PROJECT_ID}`)).toEqual({
      projectId: PROJECT_ID,
      httpsCloneUrl: `https://git.overleaf.com/${PROJECT_ID}`,
    });
  });

  it("accepts git clone command strings", () => {
    expect(parseOverleafGitUrl(`git clone https://git.overleaf.com/${PROJECT_ID}`)).toEqual({
      projectId: PROJECT_ID,
      httpsCloneUrl: `https://git.overleaf.com/${PROJECT_ID}`,
    });
  });

  it("rejects invalid urls", () => {
    expect(() => parseOverleafGitUrl("https://github.com/example/repo")).toThrow(/Invalid Overleaf Git URL/);
  });
});

describe("connectOverleafProject", () => {
  let tmpRoot = "";
  let modelRoot = "";
  let repoRoot = "";

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "tw-overleaf-"));
    modelRoot = path.join(tmpRoot, "model");
    repoRoot = path.join(tmpRoot, "repo");
    await mkdir(path.join(modelRoot, "papers/vibecount"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/vibecount/INDEX.md"),
      matter.stringify("# VibeCount\n", {
        kind: "paper",
        title: "VibeCount",
        slug: "vibecount",
        overleaf_repo_path: null,
      }),
      "utf8",
    );
  });

  afterEach(async () => {
    if (tmpRoot && existsSync(tmpRoot)) {
      execFileSync("rm", ["-rf", tmpRoot]);
    }
  });

  // Bounded so the git pull's own 8s timeout (fail-fast to "linked") lands
  // first when the sandbox/CI cannot reach git.overleaf.com.
  it("links an existing local git directory without cloning", async () => {
    const clonePath = overleafCloneDir(repoRoot, "vibecount");
    await mkdir(clonePath, { recursive: true });
    execFileSync("git", ["init"], { cwd: clonePath });

    const result = await connectOverleafProject(
      modelRoot,
      repoRoot,
      "vibecount",
      `https://git.overleaf.com/${PROJECT_ID}`,
    );

    expect(result.action).toBe("linked");
    expect(result.repoPath).toBe(clonePath);

    const index = matter(await readFile(path.join(modelRoot, "papers/vibecount/INDEX.md"), "utf8"));
    expect(index.data.overleaf_repo_path).toBe(clonePath);
    expect(index.data.overleaf_git_url).toBe(`https://git.overleaf.com/${PROJECT_ID}`);

    const status = await getOverleafStatus(modelRoot, "vibecount");
    expect(status.connected).toBe(true);
    expect(status.projectId).toBe(PROJECT_ID);
  }, 15_000);
});
