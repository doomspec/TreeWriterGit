import path from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type { Express } from "express";

import { composeSectionView } from "../compose.js";
import {
  approveDraftTarget,
  discardDraftTarget,
  findPendingAiProviderUnder,
  handleDraftFileSaved,
  handleOutlineFileSaved,
  isApprovalTrackedFilePath,
  isDraftFilePath,
  isOutlineFilePath,
  normalizeGitHubHandle,
  readApprovedContentForFile,
  readEditMetaForFile,
  unitDirFromApprovalFile,
} from "../draftApproval.js";
import {
  assetContentType,
  isAllowedAssetPath,
  listPaperFigures,
  resolveFigureMetadata,
} from "../figures.js";
import { listPaperEquations, resolveEquationMetadata } from "../equations.js";
import { getCachedGraph, invalidateGraphCache } from "../graphCache.js";
import {
  createFile,
  createNode,
  deleteNode,
  materializeDraft,
  materializeOutline,
  moveNode,
  reorderChildren,
  resolveModelPath,
  type NodeKind,
} from "../modelFs.js";
import { readModelTree } from "../modelTree.js";
import { listPaperAssets, listPaperReferences } from "../paperAssets.js";
import { searchModel, validateSearchQuery } from "../search.js";
import { syncSectionDraftToChildren } from "../sectionSync.js";
import {
  archiveNode,
  listTrashedItems,
  purgeTrashedItem,
  restoreTrashedItem,
} from "../trash.js";
import type { ServerDeps } from "./types.js";

export function registerModelRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/model/tree", async (_request, response, next) => {
    try {
      response.json({
        root: "model",
        tree: await readModelTree(deps.modelRoot),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/file", async (request, response, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/model/file", async (request, response, next) => {
    try {
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

      response.json({
        ok: true,
        path: relativePath,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/file", async (request, response, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/node", async (request, response, next) => {
    try {
      const parent = String(request.body?.parent ?? "");
      const name = String(request.body?.name ?? "");
      const kind = String(request.body?.kind ?? "") as NodeKind;
      if (!["section", "subsection", "unit", "figure", "table", "equation"].includes(kind)) {
        response.status(400).json({ error: "kind must be section, subsection, unit, figure, table, or equation" });
        return;
      }
      const created = await createNode(deps.modelRoot, parent, name, kind);
      deps.broadcastModelEvent({ type: "model-changed", path: created });
      response.status(201).json({ ok: true, path: created, kind });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/model/file", async (request, response, next) => {
    try {
      const relativePath = String(request.query.path ?? "");
      const recursive = request.query.recursive === "true";
      await deleteNode(deps.modelRoot, relativePath, recursive);
      deps.broadcastModelEvent({ type: "model-changed", path: relativePath });
      response.json({ ok: true, path: relativePath });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/archive", async (request, response, next) => {
    try {
      const relativePath = String(request.body?.path ?? "");
      const item = await archiveNode(deps.modelRoot, relativePath);
      deps.broadcastModelEvent({ type: "model-changed", path: relativePath });
      deps.broadcastModelEvent({ type: "model-changed", path: item.trashPath });
      response.status(201).json({ ok: true, item });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/trash", async (request, response, next) => {
    try {
      const paper = String(request.query.paper ?? "");
      const items = await listTrashedItems(deps.modelRoot, paper);
      response.json({ items });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/trash/restore", async (request, response, next) => {
    try {
      const paper = String(request.body?.paper ?? "");
      const itemId = String(request.body?.itemId ?? "");
      const item = await restoreTrashedItem(deps.modelRoot, paper, itemId);
      deps.broadcastModelEvent({ type: "model-changed", path: item.originalPath });
      response.json({ ok: true, item });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/model/trash", async (request, response, next) => {
    try {
      const paper = String(request.query.paper ?? "");
      const itemId = String(request.query.itemId ?? "");
      const item = await purgeTrashedItem(deps.modelRoot, paper, itemId);
      deps.broadcastModelEvent({ type: "model-changed", path: item.trashPath });
      response.json({ ok: true, item });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/move", async (request, response, next) => {
    try {
      const from = String(request.body?.from ?? "");
      const to = String(request.body?.to ?? "");
      await moveNode(deps.modelRoot, from, to);
      deps.broadcastModelEvent({ type: "model-changed", path: from });
      deps.broadcastModelEvent({ type: "model-changed", path: to });
      response.json({ ok: true, from, to });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/reorder", async (request, response, next) => {
    try {
      const parent = String(request.body?.parent ?? "");
      const childOrder = request.body?.child_order;
      await reorderChildren(deps.modelRoot, parent, childOrder);
      deps.broadcastModelEvent({ type: "model-changed", path: parent });
      response.json({ ok: true, parent });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/graph", async (request, response, next) => {
    try {
      const root = String(request.query.root ?? "");
      if (root) resolveModelPath(deps.modelRoot, root);
      response.json(await getCachedGraph(deps.modelRoot, root));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/search", async (request, response, next) => {
    try {
      const q = validateSearchQuery(String(request.query.q ?? ""));
      const root = String(request.query.root ?? "");
      if (root) resolveModelPath(deps.modelRoot, root);
      const limit = Math.min(Number(request.query.limit ?? 50) || 50, 100);
      response.json({ results: await searchModel(deps.modelRoot, q, root, limit) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/section-compose", async (request, response, next) => {
    try {
      const pathParam = String(request.query.path ?? "");
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const approvedOnly = String(request.query.approvedOnly ?? "") === "true";
      if (approvedOnly) {
        response.json(await composeSectionView(deps.modelRoot, pathParam, { approvedOnly: true }));
        return;
      }
      const [view, approvedView, pendingAiProvider] = await Promise.all([
        composeSectionView(deps.modelRoot, pathParam, { approvedOnly: false }),
        composeSectionView(deps.modelRoot, pathParam, { approvedOnly: true }),
        findPendingAiProviderUnder(deps.modelRoot, pathParam),
      ]);
      response.json({ ...view, approvedDraftMarkdown: approvedView.draftMarkdown, pendingAiProvider });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/draft-approved", async (request, response, next) => {
    try {
      const pathParam = String(request.query.path ?? "");
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      if (!isApprovalTrackedFilePath(pathParam)) {
        response.status(400).json({ error: "path must be draft.md or outline.md" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitDirFromApprovalFile(pathParam));
      const [content, meta] = await Promise.all([
        readApprovedContentForFile(deps.modelRoot, pathParam),
        readEditMetaForFile(deps.modelRoot, pathParam),
      ]);
      response.json({ content, meta });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/draft-approve", async (request, response, next) => {
    try {
      const pathParam = String(request.body?.path ?? "");
      const approvedBy = normalizeGitHubHandle(request.body?.approvedBy);
      if (!pathParam) {
        response.status(400).json({ error: "path is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const result = await approveDraftTarget(deps.modelRoot, pathParam, approvedBy);
      for (const rel of result.updated) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/draft-discard", async (request, response, next) => {
    try {
      const pathParam = String(request.body?.path ?? "");
      if (!pathParam) {
        response.status(400).json({ error: "path is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const result = await discardDraftTarget(deps.modelRoot, pathParam);
      for (const rel of result.updated) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/model/section-draft-sync", async (request, response, next) => {
    try {
      const pathParam = String(request.body?.path ?? "");
      const draftMarkdown = String(request.body?.draftMarkdown ?? "");
      const editedBy = normalizeGitHubHandle(request.body?.editedBy);
      const aiAssisted = request.body?.aiAssisted === true;
      const aiProvider =
        typeof request.body?.aiProvider === "string" && request.body.aiProvider.trim()
          ? request.body.aiProvider.trim()
          : null;
      if (!pathParam) {
        response.status(400).json({ error: "path is required" });
        return;
      }
      if (!draftMarkdown.trim()) {
        response.status(400).json({ error: "draftMarkdown is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const updated = await syncSectionDraftToChildren(deps.modelRoot, pathParam, draftMarkdown);
      const sideEffects: string[] = [];
      for (const rel of updated) {
        if (isDraftFilePath(rel)) {
          sideEffects.push(
            ...(await handleDraftFileSaved(deps.modelRoot, rel, { editedBy, aiAssisted, aiProvider })),
          );
        }
      }
      invalidateGraphCache();
      response.json({ updated: [...new Set([...updated, ...sideEffects])] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/asset", async (request, response, next) => {
    try {
      const relativePath = String(request.query.path ?? "").trim();
      if (!relativePath) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      if (!isAllowedAssetPath(relativePath)) {
        response.status(400).json({ error: "Unsupported asset type" });
        return;
      }
      const absolutePath = resolveModelPath(deps.modelRoot, relativePath);
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        response.status(400).json({ error: "Path is not a file" });
        return;
      }
      const ext = path.extname(relativePath).toLowerCase();
      const body =
        ext === ".mmd" || ext === ".svg" || ext === ".tex"
          ? await readFile(absolutePath, "utf8")
          : await readFile(absolutePath);
      response.setHeader("Content-Type", assetContentType(relativePath));
      response.send(body);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/figure", async (request, response, next) => {
    try {
      const pathParam = String(request.query.path ?? "").trim();
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam.replace(/\.md$/, ""));
      const figure = await resolveFigureMetadata(deps.modelRoot, pathParam);
      if (!figure) {
        response.status(404).json({ error: "Figure not found" });
        return;
      }
      response.json(figure);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/equation", async (request, response, next) => {
    try {
      const pathParam = String(request.query.path ?? "").trim();
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam.replace(/\.md$/, ""));
      const equation = await resolveEquationMetadata(deps.modelRoot, pathParam);
      if (!equation) {
        response.status(404).json({ error: "Equation not found" });
        return;
      }
      response.json(equation);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/figures", async (request, response, next) => {
    try {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json({ figures: await listPaperFigures(deps.modelRoot, paperPath) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/assets", async (request, response, next) => {
    try {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json(await listPaperAssets(deps.modelRoot, paperPath));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/model/references/index", async (request, response, next) => {
    try {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json({ references: await listPaperReferences(deps.modelRoot, paperPath) });
    } catch (error) {
      next(error);
    }
  });
}
