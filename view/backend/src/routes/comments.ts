import type { Express } from "express";
import type { CommentAssigneeType } from "@treewriter/shared";

import {
  createComment,
  deleteComment,
  listAssignedCommentsForPaper,
  listComments,
  parseCommentAssignee,
  summarizeCommentsForPaper,
  updateComment,
} from "../comments.js";
import { resolveModelPath } from "../modelFs.js";
import type { ServerDeps } from "./types.js";

export function registerCommentsRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/comments", async (request, response, next) => {
    try {
      const filePath = String(request.query.path ?? "");
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      response.json({ comments: await listComments(deps.modelRoot, filePath) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/comments/summary", async (request, response, next) => {
    try {
      const paperSlug = String(request.query.paperSlug ?? "");
      if (!paperSlug) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      response.json(await summarizeCommentsForPaper(deps.modelRoot, paperSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/comments/assigned", async (request, response, next) => {
    try {
      const paperSlug = String(request.query.paperSlug ?? "");
      if (!paperSlug) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      const assigneeId = request.query.assigneeId
        ? String(request.query.assigneeId)
        : undefined;
      const assigneeTypeRaw = request.query.assigneeType;
      if (
        assigneeTypeRaw !== undefined &&
        assigneeTypeRaw !== "" &&
        assigneeTypeRaw !== "human" &&
        assigneeTypeRaw !== "ai"
      ) {
        response.status(400).json({ error: "assigneeType must be human or ai" });
        return;
      }
      const assigneeType: CommentAssigneeType | undefined =
        assigneeTypeRaw === "human" || assigneeTypeRaw === "ai" ? assigneeTypeRaw : undefined;
      const filter =
        assigneeId || assigneeType
          ? { assigneeId, assigneeType }
          : undefined;
      response.json({
        comments: await listAssignedCommentsForPaper(deps.modelRoot, paperSlug, filter),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments", async (request, response, next) => {
    try {
      const { path: filePath, line, author, text, assigned_to, assigned_by } = request.body as {
        path?: string;
        line?: number;
        author?: string;
        text?: string;
        assigned_to?: unknown;
        assigned_by?: string;
      };
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      const comment = await createComment(
        deps.modelRoot,
        filePath,
        {
          line: line ?? 1,
          author: author ?? "Anonymous",
          text: text ?? "",
          assigned_to: parseCommentAssignee(assigned_to),
          assigned_by,
        },
        { repoRoot: deps.repoRoot },
      );
      deps.broadcastModelEvent({ type: "comments-changed", path: filePath });
      response.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/comments/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      const { path: filePath, text, resolved, assigned_to, assigned_by } = request.body as {
        path?: string;
        text?: string;
        resolved?: boolean;
        assigned_to?: unknown;
        assigned_by?: string;
      };
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      const comment = await updateComment(
        deps.modelRoot,
        filePath,
        id,
        {
          text,
          resolved,
          assigned_to: parseCommentAssignee(assigned_to),
          assigned_by,
        },
        { repoRoot: deps.repoRoot },
      );
      deps.broadcastModelEvent({ type: "comments-changed", path: filePath });
      response.json({ comment });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/comments/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      const filePath = String(request.query.path ?? "");
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      await deleteComment(deps.modelRoot, filePath, id);
      deps.broadcastModelEvent({ type: "comments-changed", path: filePath });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}
