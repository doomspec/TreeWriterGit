import type { Express } from "express";

import { readContributorsRegistry } from "../contributorsRegistry.js";
import type { ServerDeps } from "./types.js";

export function registerContributorsRoutes(app: Express, deps: ServerDeps): void {
  app.get("/api/contributors", async (_req, res, next) => {
    try {
      const registry = await readContributorsRegistry(deps.modelRoot);
      res.json({ registry });
    } catch (error) {
      next(error);
    }
  });
}
