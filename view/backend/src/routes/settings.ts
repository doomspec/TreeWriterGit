import type { Express } from "express";

import {
  buildGitSyncResolvePreview,
  loadProviders,
  saveDefaultProvider,
} from "../agentDispatch.js";
import { saveGitSyncPreferences } from "../gitSyncConfig.js";
import type { ServerDeps } from "./types.js";

export function registerSettingsRoutes(app: Express, deps: ServerDeps) {
  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      modelRoot: deps.modelRoot,
      gitSync: deps.getGitSyncState(),
    });
  });

  app.get("/api/git-sync/status", async (_request, response) => {
    const config = await deps.getGitSyncConfig();
    const gitSyncState = deps.getGitSyncState();
    response.json({ ...gitSyncState, autoSync: config.autoSync, intervalMs: config.intervalMs });
  });

  app.post("/api/git-sync/run", async (_request, response) => {
    response.json(await deps.runGitSync("manual"));
  });

  app.post("/api/git-sync/resolve-harness", async (request, response, next) => {
    try {
      const providerName = String(request.body?.provider ?? "").trim();
      const config = await loadProviders(deps.repoRoot);
      const provider =
        config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
      if (!provider) {
        response.status(400).json({ error: "No AI provider configured" });
        return;
      }
      const result = await buildGitSyncResolvePreview(deps.repoRoot, provider);
      response.json({
        command: result.command,
        prompt: result.prompt,
        providerName: result.providerName,
        sessionId: result.sessionId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings", async (_request, response, next) => {
    try {
      const gitSync = await deps.getGitSyncConfig();
      const agents = await loadProviders(deps.repoRoot);
      response.json({
        gitSync: {
          ...gitSync,
          status: deps.getGitSyncState(),
        },
        agents,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings/git-sync", async (request, response, next) => {
    try {
      const autoSync = request.body?.autoSync;
      if (typeof autoSync !== "boolean") {
        response.status(400).json({ error: "autoSync boolean is required" });
        return;
      }
      await saveGitSyncPreferences(deps.repoRoot, { autoSync });
      const config = await deps.getGitSyncConfig();
      response.json(config);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings/agent", async (request, response, next) => {
    try {
      const defaultProvider = String(request.body?.defaultProvider ?? "").trim();
      if (!defaultProvider) {
        response.status(400).json({ error: "defaultProvider is required" });
        return;
      }
      const agents = await saveDefaultProvider(deps.repoRoot, defaultProvider);
      response.json(agents);
    } catch (error) {
      next(error);
    }
  });
}
