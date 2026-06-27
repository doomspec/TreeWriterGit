import { readFile, stat, writeFile } from "node:fs/promises";
import type { Express } from "express";

import {
  handleDraftFileSaved,
  handleOutlineFileSaved,
  isDraftFilePath,
  isOutlineFilePath,
  normalizeGitHubHandle,
} from "../../draftApproval.js";
import {
  createFile,
  createNode,
  deleteNode,
  materializeDraft,
  materializeOutline,
  materializeTempNotes,
  moveNode,
  reorderChildren,
  resolveModelPath,
  type NodeKind,
} from "../../modelFs.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

export function registerModelCrudRoutes(app: Express, deps: ServerDeps): void {
  app.get(
    "/api/model/file",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.query.path ?? "");
      const absolutePath = resolveModelPath(deps.modelRoot, relativePath);
      let fileStat;
      try {
        fileStat = await stat(absolutePath);
      } catch (statError) {
        const errno = statError as NodeJS.ErrnoException;
        if (errno.code === "ENOENT") {
          if (relativePath === "outline.md" || relativePath.endsWith("/outline.md")) {
            const content = await materializeOutline(deps.modelRoot, relativePath);
            response.json({
              path: relativePath,
              content,
              updatedAt: new Date().toISOString(),
            });
            return;
          }
          if (relativePath === "draft.md" || relativePath.endsWith("/draft.md")) {
            const content = await materializeDraft(deps.modelRoot, relativePath);
            response.json({
              path: relativePath,
              content,
              updatedAt: new Date().toISOString(),
            });
            return;
          }
          if (relativePath === "temp-notes.md" || relativePath.endsWith("/temp-notes.md")) {
            const content = await materializeTempNotes(deps.modelRoot, relativePath);
            response.json({
              path: relativePath,
              content,
              updatedAt: new Date().toISOString(),
            });
            return;
          }
        }
        throw statError;
      }

      if (!fileStat.isFile()) {
        response.status(400).json({ error: "Path is not a file" });
        return;
      }

      response.json({
        path: relativePath,
        content: await readFile(absolutePath, "utf8"),
        updatedAt: fileStat.mtime.toISOString(),
      });
    }),
  );

  app.put(
    "/api/model/file",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.body?.path ?? "");
      const content = String(request.body?.content ?? "");
      const editedBy = normalizeGitHubHandle(request.body?.editedBy);
      const aiAssisted = request.body?.aiAssisted === true;
      const aiProvider =
        typeof request.body?.aiProvider === "string" && request.body.aiProvider.trim()
          ? request.body.aiProvider.trim()
          : null;
      const absolutePath = resolveModelPath(deps.modelRoot, relativePath);
      const fileStat = await stat(absolutePath);

      if (!fileStat.isFile()) {
        response.status(400).json({ error: "Path is not a file" });
        return;
      }

      await writeFile(absolutePath, content, "utf8");
      deps.broadcastModelEvent({ type: "model-changed", path: relativePath });

      if (isDraftFilePath(relativePath)) {
        for (const sidePath of await handleDraftFileSaved(deps.modelRoot, relativePath, {
          editedBy,
          aiAssisted,
          aiProvider,
        })) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      } else if (isOutlineFilePath(relativePath)) {
        for (const sidePath of await handleOutlineFileSaved(deps.modelRoot, relativePath, {
          editedBy,
          aiAssisted,
          aiProvider,
        })) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      }

      response.json({ ok: true, path: relativePath });
    }),
  );

  app.post(
    "/api/model/file",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.body?.path ?? "");
      const content = String(request.body?.content ?? "");
      const editedBy = normalizeGitHubHandle(request.body?.editedBy);
      const aiAssisted = request.body?.aiAssisted === true;
      const aiProvider =
        typeof request.body?.aiProvider === "string" && request.body.aiProvider.trim()
          ? request.body.aiProvider.trim()
          : null;
      const created = await createFile(deps.modelRoot, relativePath, content);
      deps.broadcastModelEvent({ type: "model-changed", path: created });
      if (isDraftFilePath(created)) {
        for (const sidePath of await handleDraftFileSaved(deps.modelRoot, created, {
          editedBy,
          aiAssisted,
          aiProvider,
        })) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      } else if (isOutlineFilePath(created)) {
        for (const sidePath of await handleOutlineFileSaved(deps.modelRoot, created, {
          editedBy,
          aiAssisted,
          aiProvider,
        })) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      }
      response.status(201).json({ ok: true, path: created });
    }),
  );

  app.post(
    "/api/model/node",
    asyncHandler(async (request, response) => {
      const parent = String(request.body?.parent ?? "");
      const name = String(request.body?.name ?? "");
      const kind = String(request.body?.kind ?? "") as NodeKind;
      if (!["section", "subsection", "unit", "figure", "table", "equation"].includes(kind)) {
        response.status(400).json({
          error: "kind must be section, subsection, unit, figure, table, or equation",
        });
        return;
      }
      const created = await createNode(deps.modelRoot, parent, name, kind);
      deps.broadcastModelEvent({ type: "model-changed", path: created });
      response.status(201).json({ ok: true, path: created, kind });
    }),
  );

  app.delete(
    "/api/model/file",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.query.path ?? "");
      const recursive = request.query.recursive === "true";
      await deleteNode(deps.modelRoot, relativePath, recursive);
      deps.broadcastModelEvent({ type: "model-changed", path: relativePath });
      response.json({ ok: true, path: relativePath });
    }),
  );

  app.post(
    "/api/model/move",
    asyncHandler(async (request, response) => {
      const from = String(request.body?.from ?? "");
      const to = String(request.body?.to ?? "");
      await moveNode(deps.modelRoot, from, to);
      deps.broadcastModelEvent({ type: "model-changed", path: from });
      deps.broadcastModelEvent({ type: "model-changed", path: to });
      response.json({ ok: true, from, to });
    }),
  );

  app.post(
    "/api/model/reorder",
    asyncHandler(async (request, response) => {
      const parent = String(request.body?.parent ?? "");
      const childOrder = request.body?.child_order;
      await reorderChildren(deps.modelRoot, parent, childOrder);
      deps.broadcastModelEvent({ type: "model-changed", path: parent });
      response.json({ ok: true, parent });
    }),
  );
}
