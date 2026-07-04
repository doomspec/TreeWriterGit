import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { buildPreview, sanitizePromptSessionId } from "./agentDispatch/commands.js";
import { validateContextPaths } from "./agentDispatch/context.js";
import { exportPaperDocx } from "./exportDocx.js";
import { ModelFsError } from "./modelFs.js";
import { deletePaper } from "./papers.js";

let modelRoot: string;
let repoRoot: string;

const provider = {
  name: "Test",
  command: "echo",
  args: ["{prompt}"],
  writesFiles: false,
};

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-pathsec-repo-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
  await mkdir(path.join(modelRoot, "Philosophy"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "Philosophy", "INDEX.md"),
    matter.stringify("", { kind: "section", title: "Philosophy" }),
    "utf8",
  );
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("paper slug traversal", () => {
  it("deletePaper rejects ../Philosophy", async () => {
    await expect(deletePaper(modelRoot, "../Philosophy")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("exportPaperDocx rejects ../Philosophy", async () => {
    await expect(
      exportPaperDocx(modelRoot, repoRoot, { paperSlug: "../Philosophy", format: "docx" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("agent path injection", () => {
  it("validateContextPaths rejects paths outside model root", () => {
    expect(() =>
      validateContextPaths(modelRoot, ["../../.treewriter-prompts/secret.txt"]),
    ).toThrow(ModelFsError);
  });

  it("buildPreview rejects malicious sessionId", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/unit"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/unit/INDEX.md"),
      matter.stringify("", { kind: "unit", status: "outline" }),
      "utf8",
    );
    await writeFile(path.join(modelRoot, "papers/demo/unit/outline.md"), "# Idea\n", "utf8");

    await expect(
      buildPreview(
        modelRoot,
        repoRoot,
        "papers/demo/unit",
        "draft",
        provider,
        undefined,
        "../escape",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sanitizePromptSessionId accepts safe ids", () => {
    expect(sanitizePromptSessionId("test-session-a")).toBe("test-session-a");
  });
});
