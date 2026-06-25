import { describe, expect, it } from "vitest";

import { commentsSidecarRel, createComment, summarizeCommentsForPaper } from "./comments.js";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("commentsSidecarRel flat papers", () => {
  it("places sidecar under paper .comments for flat layouts", () => {
    const rel = commentsSidecarRel("/tmp", "papers/vibecount/intro/draft.md");
    expect(rel).toBe("papers/vibecount/.comments/intro/draft.md.comments.json");
  });
});

describe("summarizeCommentsForPaper flat papers", () => {
  it("counts comments stored under paper .comments", async () => {
    const modelRoot = await mkdtemp(path.join(tmpdir(), "tw-flat-comments-"));
    try {
      const fileRel = "papers/vibecount/intro/draft.md";
      await mkdir(path.join(modelRoot, "papers/vibecount/intro"), { recursive: true });
      await writeFile(path.join(modelRoot, fileRel), "text", "utf8");
      await createComment(modelRoot, fileRel, { line: 1, author: "A", text: "note" });
      const summary = await summarizeCommentsForPaper(modelRoot, "vibecount");
      expect(summary.total).toBe(1);
      expect(summary.unresolved).toBe(1);
    } finally {
      await rm(modelRoot, { recursive: true, force: true });
    }
  });
});
