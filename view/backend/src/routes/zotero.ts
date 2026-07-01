import type { Express } from "express";

import {
  importZoteroItemsToMainBib,
  pingZoteroLocal,
  searchZoteroLocal,
} from "../zoteroLocal.js";
import {
  saveZoteroLocalPreferences,
  assertLocalZoteroBaseUrl,
} from "../zoteroLocalConfig.js";
import type { ServerDeps } from "./types.js";

async function requireEnabledZotero(deps: ServerDeps) {
  const config = await deps.getZoteroLocalConfig();
  if (!config.enabled) {
    return { config, forbidden: true as const };
  }
  return { config, forbidden: false as const };
}

export function registerZoteroRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/zotero/local/status", async (_request, response, next) => {
    try {
      const config = await deps.getZoteroLocalConfig();
      if (!config.enabled) {
        response.json({ enabled: false, connected: false, baseUrl: config.baseUrl });
        return;
      }
      const connected = await pingZoteroLocal(config);
      response.json({ enabled: true, connected, baseUrl: config.baseUrl });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/zotero/local/search", async (request, response, next) => {
    try {
      const { config, forbidden } = await requireEnabledZotero(deps);
      if (forbidden) {
        response.status(403).json({ error: "Local Zotero integration is disabled" });
        return;
      }
      const q = String(request.query.q ?? "").trim();
      const limitRaw = Number(request.query.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
      const hits = await searchZoteroLocal(config, q, limit);
      response.json({ hits });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/zotero/local/import", async (request, response, next) => {
    try {
      const { config, forbidden } = await requireEnabledZotero(deps);
      if (forbidden) {
        response.status(403).json({ error: "Local Zotero integration is disabled" });
        return;
      }
      const itemKeys = Array.isArray(request.body?.itemKeys)
        ? request.body.itemKeys.map((key: unknown) => String(key).trim()).filter(Boolean)
        : [];
      if (itemKeys.length === 0) {
        response.status(400).json({ error: "itemKeys must be a non-empty array" });
        return;
      }
      const result = await importZoteroItemsToMainBib(deps.modelRoot, config, itemKeys);
      deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings/zotero-local", async (request, response, next) => {
    try {
      const { enabled, baseUrl } = request.body ?? {};
      if (enabled !== undefined && typeof enabled !== "boolean") {
        response.status(400).json({ error: "enabled must be a boolean" });
        return;
      }
      if (baseUrl !== undefined && typeof baseUrl !== "string") {
        response.status(400).json({ error: "baseUrl must be a string" });
        return;
      }
      if (enabled === undefined && baseUrl === undefined) {
        response.status(400).json({ error: "No zotero-local settings provided" });
        return;
      }
      if (baseUrl !== undefined) {
        try {
          assertLocalZoteroBaseUrl(baseUrl);
        } catch (error) {
          response.status(400).json({
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
      }
      const nextConfig = await saveZoteroLocalPreferences(deps.repoRoot, {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
      });
      deps.invalidateZoteroLocalConfig?.();
      response.json(nextConfig);
    } catch (error) {
      next(error);
    }
  });
}
