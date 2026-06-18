import type { Express } from "express";

import { resolveModelPath } from "../modelFs.js";
import {
  claimPresence,
  getPresence,
  heartbeatPresence,
  releasePresence,
} from "../presence.js";
import type { ServerDeps } from "./types.js";

export function registerPresenceRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/presence", async (request, response, next) => {
    try {
      const filePath = String(request.query.path ?? "");
      if (!filePath) {
        response.status(400).json({ error: "path required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      response.json({ presence: getPresence(filePath) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/presence/claim", async (request, response, next) => {
    try {
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
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/presence/heartbeat", async (request, response, next) => {
    try {
      const { path: filePath, user } = request.body as { path?: string; user?: string };
      if (!filePath || !user) {
        response.status(400).json({ error: "path and user required" });
        return;
      }
      resolveModelPath(deps.modelRoot, filePath);
      const ok = heartbeatPresence(filePath, user);
      response.json({ ok });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/presence/claim", async (request, response, next) => {
    try {
      const filePath = String(request.query.path ?? "");
      const user = String(request.query.user ?? "");
      if (!filePath || !user) {
        response.status(400).json({ error: "path and user required" });
        return;
      }
      releasePresence(filePath, user);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}
