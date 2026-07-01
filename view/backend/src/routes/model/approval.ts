import type { Express } from "express";

import {
  approveDraftTarget,
  approvePendingChildrenTarget,
  discardDraftTarget,
  handleDraftFileSaved,
  isApprovalTrackedFilePath,
  isDraftFilePath,
  normalizeGitHubHandle,
  readApprovedContentForFile,
  refreshPendingManuscriptMeta,
  unitDirFromApprovalFile,
} from "../../draftApproval.js";
import { invalidateGraphCache } from "../../graphCache.js";
import { resolveModelPath } from "../../modelFs.js";
import { syncSectionDraftToChildren } from "../../sectionSync.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

export function registerModelApprovalRoutes(app: Express, deps: ServerDeps): void {
  app.get(
    "/api/model/draft-approved",
    asyncHandler(async (request, response) => {
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
      const content = await readApprovedContentForFile(deps.modelRoot, pathParam);
      const { updated, meta } = await refreshPendingManuscriptMeta(deps.modelRoot, pathParam, {
        repoRoot: deps.repoRoot,
        agentJobs: deps.agentJobs,
      });
      for (const rel of updated) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }
      response.json({ content, meta });
    }),
  );

  app.post(
    "/api/model/draft-approve",
    asyncHandler(async (request, response) => {
      const pathParam = String(request.body?.path ?? "");
      const approvedBy = normalizeGitHubHandle(request.body?.approvedBy);
      if (!pathParam) {
        response.status(400).json({ error: "path is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const result = await approveDraftTarget(deps.modelRoot, pathParam, approvedBy, {
        repoRoot: deps.repoRoot,
      });
      for (const rel of result.updated) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }
      response.json(result);
    }),
  );

  app.post(
    "/api/model/draft-approve-children",
    asyncHandler(async (request, response) => {
      const pathParam = String(request.body?.path ?? "");
      const approvedBy = normalizeGitHubHandle(request.body?.approvedBy);
      if (!pathParam) {
        response.status(400).json({ error: "path is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam);
      const result = await approvePendingChildrenTarget(deps.modelRoot, pathParam, approvedBy, {
        repoRoot: deps.repoRoot,
      });
      for (const rel of result.updated) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }
      response.json(result);
    }),
  );

  app.post(
    "/api/model/draft-discard",
    asyncHandler(async (request, response) => {
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
    }),
  );

  app.post(
    "/api/model/section-draft-sync",
    asyncHandler(async (request, response) => {
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
    }),
  );
}
