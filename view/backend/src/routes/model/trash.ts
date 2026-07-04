import type { Express } from "express";

import {
  archiveNode,
  listTrashedItems,
  purgeAllTrashedItems,
  purgeTrashedItem,
  restoreTrashedItem,
} from "../../trash.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

export function registerModelTrashRoutes(app: Express, deps: ServerDeps): void {
  app.post(
    "/api/model/archive",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.body?.path ?? "");
      const item = await archiveNode(deps.modelRoot, relativePath);
      deps.broadcastModelEvent({ type: "model-changed", path: relativePath });
      deps.broadcastModelEvent({ type: "model-changed", path: item.trashPath });
      response.status(201).json({ ok: true, item });
    }),
  );

  app.get(
    "/api/model/trash",
    asyncHandler(async (request, response) => {
      const paper = String(request.query.paper ?? "");
      const items = await listTrashedItems(deps.modelRoot, paper);
      response.json({ items });
    }),
  );

  app.post(
    "/api/model/trash/restore",
    asyncHandler(async (request, response) => {
      const paper = String(request.body?.paper ?? "");
      const itemId = String(request.body?.itemId ?? "");
      const item = await restoreTrashedItem(deps.modelRoot, paper, itemId);
      deps.broadcastModelEvent({ type: "model-changed", path: item.originalPath });
      response.json({ ok: true, item });
    }),
  );

  app.delete(
    "/api/model/trash",
    asyncHandler(async (request, response) => {
      const paper = String(request.query.paper ?? "");
      const itemId = String(request.query.itemId ?? "");
      const item = await purgeTrashedItem(deps.modelRoot, paper, itemId);
      deps.broadcastModelEvent({ type: "model-changed", path: item.trashPath });
      response.json({ ok: true, item });
    }),
  );

  app.delete(
    "/api/model/trash/all",
    asyncHandler(async (request, response) => {
      const paper = String(request.query.paper ?? "");
      const result = await purgeAllTrashedItems(deps.modelRoot, paper);
      deps.broadcastModelEvent({ type: "model-changed", path: `${paper}/.trash` });
      response.json({ ok: true, ...result });
    }),
  );
}
