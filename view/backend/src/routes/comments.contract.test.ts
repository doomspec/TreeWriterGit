import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import type { CommentRecord, CommentSummary } from "@treewriter/shared";

import { createTestServer } from "../test/createTestApp.js";

const fileRel = "papers/ml/sections/intro/draft.md";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-comments-contract-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(path.join(modelRoot, path.dirname(fileRel)), { recursive: true });
  await writeFile(path.join(modelRoot, fileRel), "# Intro\n\nBody\n", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function expectCommentShape(comment: CommentRecord) {
  expect(typeof comment.id).toBe("string");
  expect(comment.id.length).toBeGreaterThan(0);
  expect(comment.file).toBe(fileRel);
  expect(typeof comment.line).toBe("number");
  expect(typeof comment.author).toBe("string");
  expect(typeof comment.text).toBe("string");
  expect(typeof comment.resolved).toBe("boolean");
  expect(typeof comment.created_at).toBe("string");
}

function expectSummaryShape(summary: CommentSummary) {
  expect(summary).toEqual(
    expect.objectContaining({
      total: expect.any(Number),
      unresolved: expect.any(Number),
      assigned: expect.any(Number),
      assignedUnresolved: expect.any(Number),
    }),
  );
}

describe("comments API contract", () => {
  it("POST comment, PATCH assignee, GET summary with assigned counts", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);

      const createRes = await agent.post("/api/comments").send({
        path: fileRel,
        line: 2,
        author: "Alice",
        text: "Tighten opening",
      });
      expect(createRes.status).toBe(201);
      expect(createRes.body).toEqual(
        expect.objectContaining({
          comment: expect.any(Object),
        }),
      );
      const created = createRes.body.comment as CommentRecord;
      expectCommentShape(created);
      expect(created.text).toBe("Tighten opening");
      expect(created.assigned_to).toBeUndefined();

      const assignRes = await agent.patch(`/api/comments/${created.id}`).send({
        path: fileRel,
        assigned_to: { type: "human", id: "bob", label: "Bob" },
        assigned_by: "Alice",
      });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body).toEqual(
        expect.objectContaining({
          comment: expect.any(Object),
        }),
      );
      const assigned = assignRes.body.comment as CommentRecord;
      expectCommentShape(assigned);
      expect(assigned.assigned_to).toEqual({
        type: "human",
        id: "bob",
        label: "Bob",
      });
      expect(assigned.assigned_by).toBe("Alice");
      expect(typeof assigned.assigned_at).toBe("string");

      const listRes = await agent.get("/api/comments").query({ path: fileRel });
      expect(listRes.status).toBe(200);
      expect(listRes.body).toEqual({
        comments: expect.arrayContaining([expect.objectContaining({ id: created.id })]),
      });
      for (const comment of listRes.body.comments as CommentRecord[]) {
        expectCommentShape(comment);
      }

      const summaryRes = await agent.get("/api/comments/summary").query({ paperSlug: "ml" });
      expect(summaryRes.status).toBe(200);
      expectSummaryShape(summaryRes.body as CommentSummary);
      expect(summaryRes.body).toMatchObject({
        total: 1,
        unresolved: 1,
        assigned: 1,
        assignedUnresolved: 1,
      });
    } finally {
      await server.close();
    }
  });

  it("GET /assigned filters by assignee and rejects invalid assigneeType", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);

      const humanRes = await agent.post("/api/comments").send({
        path: fileRel,
        line: 2,
        author: "Alice",
        text: "Human task",
        assigned_to: { type: "human", id: "bob", label: "Bob" },
        assigned_by: "Alice",
      });
      expect(humanRes.status).toBe(201);
      const humanComment = humanRes.body.comment as CommentRecord;

      const aiRes = await agent.post("/api/comments").send({
        path: fileRel,
        line: 3,
        author: "Alice",
        text: "AI task",
        assigned_to: { type: "ai", id: "Claude Code", label: "Claude Code" },
        assigned_by: "Alice",
      });
      expect(aiRes.status).toBe(201);
      const aiComment = aiRes.body.comment as CommentRecord;

      const invalidTypeRes = await agent
        .get("/api/comments/assigned")
        .query({ paperSlug: "ml", assigneeType: "bot" });
      expect(invalidTypeRes.status).toBe(400);
      expect(invalidTypeRes.body).toEqual({
        error: "assigneeType must be human or ai",
      });

      const humanAssignedRes = await agent
        .get("/api/comments/assigned")
        .query({ paperSlug: "ml", assigneeType: "human" });
      expect(humanAssignedRes.status).toBe(200);
      expect(humanAssignedRes.body.comments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: humanComment.id, assigned_to: humanComment.assigned_to }),
        ]),
      );
      expect(
        (humanAssignedRes.body.comments as CommentRecord[]).some((c) => c.id === aiComment.id),
      ).toBe(false);

      const byIdRes = await agent
        .get("/api/comments/assigned")
        .query({ paperSlug: "ml", assigneeId: "bob", assigneeType: "human" });
      expect(byIdRes.status).toBe(200);
      expect(byIdRes.body.comments).toHaveLength(1);
      expect(byIdRes.body.comments[0].id).toBe(humanComment.id);
    } finally {
      await server.close();
    }
  });

  it("PATCH assignee roundtrip: assign, clear, reassign", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);

      const createRes = await agent.post("/api/comments").send({
        path: fileRel,
        line: 2,
        author: "Alice",
        text: "Needs owner",
      });
      expect(createRes.status).toBe(201);
      const created = createRes.body.comment as CommentRecord;
      expect(created.assigned_to).toBeUndefined();

      const assignRes = await agent.patch(`/api/comments/${created.id}`).send({
        path: fileRel,
        assigned_to: { type: "human", id: "carol", label: "Carol" },
        assigned_by: "Alice",
      });
      expect(assignRes.status).toBe(200);
      const assigned = assignRes.body.comment as CommentRecord;
      expect(assigned.assigned_to).toEqual({
        type: "human",
        id: "carol",
        label: "Carol",
      });
      expect(assigned.assigned_by).toBe("Alice");
      expect(typeof assigned.assigned_at).toBe("string");

      const clearRes = await agent.patch(`/api/comments/${created.id}`).send({
        path: fileRel,
        assigned_to: null,
        assigned_by: "Alice",
      });
      expect(clearRes.status).toBe(200);
      const cleared = clearRes.body.comment as CommentRecord;
      expect(cleared.assigned_to).toBeNull();
      expect(cleared.assigned_by).toBeNull();

      const reassignRes = await agent.patch(`/api/comments/${created.id}`).send({
        path: fileRel,
        assigned_to: { type: "ai", id: "Claude Code", label: "Claude Code" },
        assigned_by: "Bob",
      });
      expect(reassignRes.status).toBe(200);
      const reassigned = reassignRes.body.comment as CommentRecord;
      expect(reassigned.assigned_to).toEqual({
        type: "ai",
        id: "Claude Code",
        label: "Claude Code",
      });
      expect(reassigned.assigned_by).toBe("Bob");

      const listRes = await agent.get("/api/comments").query({ path: fileRel });
      expect(listRes.status).toBe(200);
      const listed = (listRes.body.comments as CommentRecord[]).find((c) => c.id === created.id);
      expect(listed?.assigned_to).toEqual(reassigned.assigned_to);
    } finally {
      await server.close();
    }
  });
});
