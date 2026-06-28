import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { GEMINI_WORKSPACE_PREAMBLE } from "../agentDispatch/providers.js";
import { createSession } from "../sessions.js";
import { createNode } from "../modelFs.js";
import { handleExternalManuscriptWrite, readDraftEditMeta, refreshPendingManuscriptMeta } from "./index.js";

let modelRoot: string;
let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-ext-write-repo-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
  await createNode(modelRoot, "papers", "demo", "section");
  await createNode(modelRoot, "papers/demo", "unit-a", "unit");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("handleExternalManuscriptWrite", () => {
  it("marks terminal AI edits from recent prompt files", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const promptsDir = path.join(modelRoot, ".treewriter-prompts");
    await mkdir(promptsDir, { recursive: true });
    await writeFile(
      path.join(promptsDir, "preview-test.txt"),
      `${GEMINI_WORKSPACE_PREAMBLE}Write to ${draftRel}`,
      "utf8",
    );
    await writeFile(path.join(modelRoot, draftRel), "AI draft text.\n", "utf8");
    await writeFile(
      path.join(modelRoot, "papers/demo/unit-a/INDEX.md"),
      matter.stringify("", { kind: "unit", status: "approved", edited_by: "yakavetsiv" }),
      "utf8",
    );

    const updated = await handleExternalManuscriptWrite(modelRoot, draftRel, { repoRoot });
    expect(updated.some((p) => p.endsWith("INDEX.md"))).toBe(true);

    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.editedBy).toBeNull();
    expect(meta.aiProvider).toBeTruthy();
  });

  it("marks terminal AI edits from recent sessions", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "AI draft text.\n", "utf8");
    await createSession(modelRoot, "papers/demo/unit-a", {
      at: new Date().toISOString(),
      provider: "Gemini CLI",
      action: "draft",
      command: "gemini -p ...",
      status: "dispatched",
    });

    await handleExternalManuscriptWrite(modelRoot, draftRel, { repoRoot });
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.aiProvider).toBe("Gemini CLI");
    expect(meta.editedBy).toBeNull();
  });

  it("clears stale human attribution for external non-AI edits", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Manual edit.\n", "utf8");
    await writeFile(
      path.join(modelRoot, "papers/demo/unit-a/INDEX.md"),
      matter.stringify("", { kind: "unit", status: "approved", edited_by: "yakavetsiv" }),
      "utf8",
    );

    await handleExternalManuscriptWrite(modelRoot, draftRel, { repoRoot });
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(false);
    expect(meta.editedBy).toBeNull();
  });

  it("refreshPendingManuscriptMeta upgrades stale pending metadata on load", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const promptsDir = path.join(modelRoot, ".treewriter-prompts");
    await mkdir(promptsDir, { recursive: true });
    await writeFile(
      path.join(promptsDir, "preview-load.txt"),
      `${GEMINI_WORKSPACE_PREAMBLE}Write to ${draftRel}`,
      "utf8",
    );
    await writeFile(path.join(modelRoot, draftRel), "Pending AI draft.\n", "utf8");
    await writeFile(
      path.join(modelRoot, "papers/demo/unit-a/INDEX.md"),
      matter.stringify("", {
        kind: "unit",
        status: "approved",
        edited_by: "yakavetsiv",
        ai_assisted: false,
      }),
      "utf8",
    );

    const { updated, meta } = await refreshPendingManuscriptMeta(modelRoot, draftRel, { repoRoot });
    expect(updated.some((p) => p.endsWith("INDEX.md"))).toBe(true);
    expect(meta.aiAssisted).toBe(true);
    expect(meta.editedBy).toBeNull();
    expect(meta.aiProvider).toBeTruthy();
  });
});
