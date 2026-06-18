import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import {
  approveDraftTarget,
  discardDraftTarget,
  draftsMatchApproved,
  handleDraftFileSaved,
  markDraftAiAssisted,
  readDraftEditMeta,
} from "./draftApproval.js";
import { createNode } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-draft-approval-"));
  await createNode(modelRoot, "papers", "demo", "section");
  await createNode(modelRoot, "papers/demo", "unit-a", "unit");
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("draftApproval", () => {
  it("autosave marks unit drafted when draft diverges from approved", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Working text.\n", "utf8");
    const updated = await handleDraftFileSaved(modelRoot, draftRel);
    expect(updated.some((p) => p.endsWith("INDEX.md"))).toBe(true);
    const index = matter(await readFile(path.join(modelRoot, "papers/demo/unit-a/INDEX.md"), "utf8"));
    expect(index.data.status).toBe("drafted");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(false);
  });

  it("records editor and AI metadata on save", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Working text.\n", "utf8");
    await handleDraftFileSaved(modelRoot, draftRel, {
      editedBy: "octocat",
      aiAssisted: true,
    });
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.editedBy).toBe("octocat");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.editedAt).toBeTruthy();
  });

  it("approve copies draft.approved.md and sets status approved", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Final text.\n", "utf8");
    const result = await approveDraftTarget(modelRoot, draftRel, "reviewer");
    expect(result.updated).toContain("papers/demo/unit-a/draft.approved.md");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(true);
    const index = matter(await readFile(path.join(modelRoot, "papers/demo/unit-a/INDEX.md"), "utf8"));
    expect(index.data.status).toBe("approved");
    expect(index.data.approved_by).toBe("reviewer");
    expect(index.data.approved_at).toBeTruthy();
  });

  it("markDraftAiAssisted flags AI edits", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "AI text.\n", "utf8");
    await markDraftAiAssisted(modelRoot, "papers/demo/unit-a", "octocat");
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.editedBy).toBe("octocat");
    expect(meta.aiAssisted).toBe(true);
  });

  it("discard restores draft.md from draft.approved.md", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Approved text.\n", "utf8");
    await approveDraftTarget(modelRoot, draftRel);
    await writeFile(path.join(modelRoot, draftRel), "Experimental edit.\n", "utf8");
    await handleDraftFileSaved(modelRoot, draftRel, { editedBy: "octocat", aiAssisted: true });
    await discardDraftTarget(modelRoot, draftRel);
    expect(await readFile(path.join(modelRoot, draftRel), "utf8")).toBe("Approved text.\n");
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(false);
    expect(meta.editedBy).toBeNull();
  });
});
