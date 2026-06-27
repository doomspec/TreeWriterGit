import type { Express } from "express";

import { resolveModelPath } from "../modelFs.js";
import {
  claimPresence,
  getPresence,
  heartbeatPresence,
  releasePresence,
} from "../presence.js";
import { asyncHandler } from "./asyncHandler.js";
import type { ServerDeps } from "./types.js";

export function registerPresenceRoutes(app: Express, deps: ServerDeps) {
  app.get(
    "/api/presence",
    asyncHandler(async (request, response) => {
      const filePath = String(request.query.path ?? "");
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      response.json({ presence: getPresence(filePath) });
    }),
  );

  app.post(
    "/api/presence/claim",
    asyncHandler(async (request, response) => {
      const { path: filePath, user } = request.body as { path?: string; user?: string };
      if (!filePath || !user) {
        response.status(400).json({ error: "path and user required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      const conflict = claimPresence(filePath, user);
      if (conflict) {
        response.status(409).json({ error: "Path in use", presence: conflict });
        return;
      }
      response.json({ ok: true });
    }),
  );

  app.post(
    "/api/presence/heartbeat",
    asyncHandler(async (request, response) => {
      const { path: filePath, user } = request.body as { path?: string; user?: string };
      if (!filePath || !user) {
        response.status(400).json({ error: "path and user required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      const ok = heartbeatPresence(filePath, user);
      response.json({ ok });
    }),
  );

  app.delete(
    "/api/presence/claim",
    asyncHandler(async (request, response) => {
      const filePath = String(request.query.path ?? "");
      const user = String(request.query.user ?? "");
      if (!filePath || !user) {
        response.status(400).json({ error: "path and user required" });
        return;
      }
      releasePresence(filePath, user);
      response.json({ ok: true });
    }),
  );
}
