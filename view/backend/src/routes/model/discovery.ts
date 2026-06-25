import type { Express, Request } from "express";

import { composeSectionView } from "../../compose.js";
import { findPendingAiProviderUnder } from "../../draftApproval.js";
import { getCachedGraph } from "../../graphCache.js";
import { ModelFsError, resolveModelPath } from "../../modelFs.js";
import { getModelTreeVersion } from "../../modelEvents.js";
import { getCachedModelTree } from "../../modelTreeCache.js";
import { searchModel, validateSearchQuery } from "../../search.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

function parseTreeDepth(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new ModelFsError("Invalid depth query parameter", 400);
  }
  return value;
}

function normalizeTreeRoot(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  return String(raw).replace(/\\/g, "/").replace(/\/+$/, "");
}

export function registerModelDiscoveryRoutes(app: Express, deps: ServerDeps): void {
  app.get(
    "/api/model/tree",
    asyncHandler(async (request: Request, response) => {
      const rootPath = normalizeTreeRoot(request.query.path);
      const maxDepth = parseTreeDepth(request.query.depth);
      if (rootPath) resolveModelPath(deps.modelRoot, rootPath);

      response.json({
        root: rootPath || "model",
        treeVersion: getModelTreeVersion(),
        tree: await getCachedModelTree(deps.modelRoot, { rootPath, maxDepth }),
      });
    }),
  );

  app.get(
    "/api/model/graph",
    asyncHandler(async (request, response) => {
      const root = String(request.query.root ?? "");
      if (root) resolveModelPath(deps.modelRoot, root);
      response.json(await getCachedGraph(deps.modelRoot, root));
    }),
  );

  app.get(
    "/api/model/search",
    asyncHandler(async (request, response) => {
      const q = validateSearchQuery(String(request.query.q ?? ""));
      const root = String(request.query.root ?? "");
      if (root) resolveModelPath(deps.modelRoot, root);
      const limit = Math.min(Number(request.query.limit ?? 50) || 50, 100);
      response.json({ results: await searchModel(deps.modelRoot, q, root, limit) });
    }),
  );

  app.get(
    "/api/model/section-compose",
    asyncHandler(async (request, response) => {
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
    }),
  );
}
