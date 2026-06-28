import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import {
  approveDraftTarget,
  approvePendingChildrenTarget,
  collectPendingApprovalPaths,
  collectPendingReviewItems,
  isChildApprovalFilePath,
  discardDraftTarget,
  draftsMatchApproved,
  handleDraftFileSaved,
  handleOutlineFileSaved,
  markDraftAiAssisted,
  markOutlineAiAssisted,
  outlinesMatchApproved,
  readDraftEditMeta,
  readOutlineEditMeta,
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
    await markDraftAiAssisted(modelRoot, "papers/demo/unit-a", "octocat", "Codex");
    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.editedBy).toBe("octocat");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.aiProvider).toBe("Codex");
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

  it("autosave marks outline pending when outline diverges from approved", async () => {
    const outlineRel = "papers/demo/unit-a/outline.md";
    await writeFile(path.join(modelRoot, outlineRel), "Working outline.\n", "utf8");
    const updated = await handleOutlineFileSaved(modelRoot, outlineRel);
    expect(updated.some((p) => p.endsWith("INDEX.md"))).toBe(true);
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(false);
  });

  it("markOutlineAiAssisted flags AI outline edits", async () => {
    const outlineRel = "papers/demo/unit-a/outline.md";
    await writeFile(path.join(modelRoot, outlineRel), "AI outline.\n", "utf8");
    await markOutlineAiAssisted(modelRoot, "papers/demo/unit-a", "octocat", "Claude Code");
    const meta = await readOutlineEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.editedBy).toBe("octocat");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.aiProvider).toBe("Claude Code");
  });

  it("approve copies outline.approved.md without changing draft status", async () => {
    const outlineRel = "papers/demo/unit-a/outline.md";
    await writeFile(path.join(modelRoot, outlineRel), "Final outline.\n", "utf8");
    await writeFile(path.join(modelRoot, "papers/demo/unit-a/INDEX.md"), matter.stringify("", {
      kind: "unit",
      status: "approved",
    }), "utf8");
    const result = await approveDraftTarget(modelRoot, outlineRel, "reviewer");
    expect(result.updated).toContain("papers/demo/unit-a/outline.approved.md");
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(true);
    const index = matter(await readFile(path.join(modelRoot, "papers/demo/unit-a/INDEX.md"), "utf8"));
    expect(index.data.status).toBe("approved");
    expect(index.data.outline_approved_by).toBe("reviewer");
  });

  it("discard restores outline.md from outline.approved.md", async () => {
    const outlineRel = "papers/demo/unit-a/outline.md";
    await writeFile(path.join(modelRoot, outlineRel), "Approved outline.\n", "utf8");
    await approveDraftTarget(modelRoot, outlineRel);
    await writeFile(path.join(modelRoot, outlineRel), "Experimental outline.\n", "utf8");
    await handleOutlineFileSaved(modelRoot, outlineRel, { editedBy: "octocat", aiAssisted: true });
    await discardDraftTarget(modelRoot, outlineRel);
    expect(await readFile(path.join(modelRoot, outlineRel), "utf8")).toBe("Approved outline.\n");
    const meta = await readOutlineEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(false);
  });

  it("isChildApprovalFilePath excludes the section's own draft and outline", () => {
    const section = "papers/demo/intro";
    expect(isChildApprovalFilePath(section, "papers/demo/intro/draft.md")).toBe(false);
    expect(isChildApprovalFilePath(section, "papers/demo/intro/outline.md")).toBe(false);
    expect(isChildApprovalFilePath(section, "papers/demo/intro/u1/draft.md")).toBe(true);
    expect(isChildApprovalFilePath(section, "papers/demo/intro/u1/outline.md")).toBe(true);
  });

  it("approvePendingChildrenTarget approves pending child drafts and outlines only", async () => {
    await createNode(modelRoot, "papers/demo", "intro", "section");
    await createNode(modelRoot, "papers/demo/intro", "u1", "unit");
    await createNode(modelRoot, "papers/demo/intro", "u2", "unit");
    const childDraft = "papers/demo/intro/u1/draft.md";
    const childOutline = "papers/demo/intro/u2/outline.md";
    await writeFile(path.join(modelRoot, childDraft), "Child draft.\n", "utf8");
    await writeFile(path.join(modelRoot, childOutline), "Child outline.\n", "utf8");
    await writeFile(path.join(modelRoot, "papers/demo/intro/draft.md"), "Section draft.\n", "utf8");

    const result = await approvePendingChildrenTarget(modelRoot, "papers/demo/intro", "reviewer");
    expect(result.updated).toContain("papers/demo/intro/u1/draft.approved.md");
    expect(result.updated).toContain("papers/demo/intro/u2/outline.approved.md");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/intro/u1")).toBe(true);
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/intro/u2")).toBe(true);
  });

  it("approveDraftTarget approves all child drafts under a section path", async () => {
    await createNode(modelRoot, "papers/demo", "intro", "section");
    await createNode(modelRoot, "papers/demo/intro", "u1", "unit");
    const draftRel = "papers/demo/intro/u1/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Child draft.\n", "utf8");
    const result = await approveDraftTarget(modelRoot, "papers/demo/intro", "reviewer");
    expect(result.updated).toContain("papers/demo/intro/u1/draft.approved.md");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/intro/u1")).toBe(true);
  });

  it("approveDraftTarget approves a leaf section draft.md with no child folders", async () => {
    await createNode(modelRoot, "papers/demo", "abstract", "section");
    const draftRel = "papers/demo/abstract/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Abstract paragraph.\n", "utf8");
    const result = await approveDraftTarget(modelRoot, "papers/demo/abstract", "reviewer");
    expect(result.updated).toContain("papers/demo/abstract/draft.approved.md");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/abstract")).toBe(true);
  });

  it("collectPendingApprovalPaths lists draft and outline files awaiting approval", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const outlineRel = "papers/demo/unit-a/outline.md";
    await writeFile(path.join(modelRoot, draftRel), "Pending draft.\n", "utf8");
    await writeFile(path.join(modelRoot, outlineRel), "Pending outline.\n", "utf8");

    const paths = await collectPendingApprovalPaths(modelRoot, "papers/demo");
    expect(paths).toContain(draftRel);
    expect(paths).toContain(outlineRel);

    await approveDraftTarget(modelRoot, draftRel);
    await approveDraftTarget(modelRoot, outlineRel);
    const after = await collectPendingApprovalPaths(modelRoot, "papers/demo");
    expect(after).not.toContain(draftRel);
    expect(after).not.toContain(outlineRel);
  });

  it("collectPendingReviewItems includes author and AI metadata with change stats", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    await writeFile(path.join(modelRoot, draftRel), "Pending draft line.\n", "utf8");
    await markDraftAiAssisted(modelRoot, "papers/demo/unit-a", null, "Claude Code");

    const items = await collectPendingReviewItems(modelRoot, "papers/demo");
    const draftItem = items.find((item) => item.path === draftRel);
    expect(draftItem).toBeDefined();
    expect(draftItem?.kind).toBe("draft");
    expect(draftItem?.aiAssisted).toBe(true);
    expect(draftItem?.aiProvider).toBe("Claude Code");
    expect(draftItem?.changeSummary.addedLines).toBeGreaterThan(0);
  });

  it("propagates draft approval to parent section when all child drafts are approved", async () => {
    await createNode(modelRoot, "papers/demo", "results", "section");
    await createNode(modelRoot, "papers/demo/results", "u1", "unit");
    await createNode(modelRoot, "papers/demo/results", "u2", "unit");
    const sectionOutlineRel = "papers/demo/results/outline.md";
    const u1OutlineRel = "papers/demo/results/u1/outline.md";
    const u2OutlineRel = "papers/demo/results/u2/outline.md";
    await writeFile(
      path.join(modelRoot, sectionOutlineRel),
      "# Results\n\n## Summary\n\nSection summary.\n\n## Outline\n\n- [U1](u1/INDEX.md)\n- [U2](u2/INDEX.md)\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, u1OutlineRel),
      "# U1\n\n## Summary\n\nFirst summary.\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, u2OutlineRel),
      "# U2\n\n## Summary\n\nSecond summary.\n",
      "utf8",
    );

    await approveDraftTarget(modelRoot, u1OutlineRel, "reviewer");
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/results/u1")).toBe(true);
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/results")).toBe(false);

    await approveDraftTarget(modelRoot, u2OutlineRel, "reviewer");
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/results/u2")).toBe(true);
    expect(await outlinesMatchApproved(modelRoot, "papers/demo/results")).toBe(true);
  });
});
