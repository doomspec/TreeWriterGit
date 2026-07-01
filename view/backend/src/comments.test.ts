import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  commentsSidecarRel,
  createComment,
  deleteComment,
  listComments,
  summarizeCommentsForPaper,
  updateComment,
} from "./comments.js";
import { ModelFsError } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-comments-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("commentsSidecarRel", () => {
  it("places sidecar under sections/.comments for paper files", () => {
    const rel = commentsSidecarRel(
      modelRoot,
      "papers/ml/sections/intro/problem/draft.md",
    );
    expect(rel).toBe("papers/ml/sections/.comments/intro/problem/draft.md.comments.json");
  });

  it("uses model .comments for non-paper paths", () => {
    const rel = commentsSidecarRel(modelRoot, "shared/glossary.md");
    expect(rel).toBe(".comments/shared/glossary.md.comments.json");
  });
});

describe("comments CRUD", () => {
  beforeEach(async () => {
    const fileRel = "papers/ml/sections/intro/draft.md";
    await mkdir(path.join(modelRoot, path.dirname(fileRel)), { recursive: true });
    await writeFile(path.join(modelRoot, fileRel), "# Intro\n\nBody\n", "utf8");
  });

  it("creates and lists comments", async () => {
    const fileRel = "papers/ml/sections/intro/draft.md";
    const created = await createComment(modelRoot, fileRel, {
      line: 2,
      author: "Ilya",
      text: "Tighten opening",
    });
    expect(created.id).toBeTruthy();
    const list = await listComments(modelRoot, fileRel);
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("Tighten opening");
    const raw = await readFile(path.join(modelRoot, fileRel), "utf8");
    expect(raw).toContain("<comment");
    expect(raw).toContain("Tighten opening");
  });

  it("updates and deletes comments", async () => {
    const created = await createComment(modelRoot, "papers/ml/sections/intro/draft.md", {
      line: 1,
      author: "Ilya",
      text: "Note",
    });
    const updated = await updateComment(
      modelRoot,
      "papers/ml/sections/intro/draft.md",
      created.id,
      { resolved: true },
    );
    expect(updated.resolved).toBe(true);
    await deleteComment(modelRoot, "papers/ml/sections/intro/draft.md", created.id);
    expect(await listComments(modelRoot, "papers/ml/sections/intro/draft.md")).toHaveLength(0);
  });

  it("rejects non-markdown paths", async () => {
    await expect(
      createComment(modelRoot, "papers/ml/sections/intro/draft.txt", {
        line: 1,
        author: "Ilya",
        text: "x",
      }),
    ).rejects.toBeInstanceOf(ModelFsError);
  });
});

describe("summarizeCommentsForPaper", () => {
  it("counts unresolved comments", async () => {
    const fileRel = "papers/ml/sections/intro/draft.md";
    await mkdir(path.join(modelRoot, path.dirname(fileRel)), { recursive: true });
    await writeFile(path.join(modelRoot, fileRel), "text", "utf8");
    await createComment(modelRoot, fileRel, { line: 1, author: "A", text: "one" });
    const c2 = await createComment(modelRoot, fileRel, { line: 2, author: "B", text: "two" });
    await updateComment(modelRoot, fileRel, c2.id, { resolved: true });

    const summary = await summarizeCommentsForPaper(modelRoot, "ml");
    expect(summary.total).toBe(2);
    expect(summary.unresolved).toBe(1);
    expect(summary.assigned).toBe(0);
    expect(summary.assignedUnresolved).toBe(0);
  });

  it("returns empty list when manuscript file is missing", async () => {
    const list = await listComments(modelRoot, "papers/ml/sections/intro/draft.md");
    expect(list).toEqual([]);
  });

  it("assigns and clears assignee with summary counts", async () => {
    const fileRel = "papers/ml/sections/intro/draft.md";
    await mkdir(path.join(modelRoot, path.dirname(fileRel)), { recursive: true });
    await writeFile(path.join(modelRoot, fileRel), "text", "utf8");
    const created = await createComment(modelRoot, fileRel, {
      line: 1,
      author: "Alice",
      text: "Fix this",
    });
    const assigned = await updateComment(modelRoot, fileRel, created.id, {
      assigned_to: { type: "human", id: "bob", label: "Bob" },
      assigned_by: "Alice",
    });
    expect(assigned.assigned_to?.id).toBe("bob");

    let summary = await summarizeCommentsForPaper(modelRoot, "ml");
    expect(summary.assigned).toBe(1);
    expect(summary.assignedUnresolved).toBe(1);

    await updateComment(modelRoot, fileRel, created.id, { assigned_to: null });
    summary = await summarizeCommentsForPaper(modelRoot, "ml");
    expect(summary.assigned).toBe(0);
  });
});
