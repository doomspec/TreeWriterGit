import { describe, expect, it } from "vitest";

import { resolveOverleafRepoPath, overleafCloneDir } from "./overleaf.js";
import { ModelFsError } from "./modelFs.js";

describe("resolveOverleafRepoPath", () => {
  const repoRoot = "/repo";
  const slug = "demo";

  it("returns default clone dir when configured path is empty", () => {
    expect(resolveOverleafRepoPath(repoRoot, slug, null)).toBe(
      overleafCloneDir(repoRoot, slug),
    );
  });

  it("accepts the canonical clone path", () => {
    const allowed = overleafCloneDir(repoRoot, slug);
    expect(resolveOverleafRepoPath(repoRoot, slug, allowed)).toBe(allowed);
  });

  it("rejects paths outside .overleaf/{slug}", () => {
    expect(() => resolveOverleafRepoPath(repoRoot, slug, "/etc/passwd")).toThrow(ModelFsError);
    expect(() => resolveOverleafRepoPath(repoRoot, slug, "/repo/.overleaf/other")).toThrow(
      /overleaf_repo_path must resolve/,
    );
  });
});
