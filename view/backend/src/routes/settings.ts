import type { Express } from "express";

import {
  buildGitSyncResolvePreview,
  loadProviders,
  saveDefaultProvider,
} from "../agentDispatch.js";
import { saveGitSyncPreferences } from "../gitSyncConfig.js";
import { saveExportPreferences, isAllowedExportDebounceMs } from "../exportConfig.js";
import { loadZoteroLocalConfig } from "../zoteroLocalConfig.js";
import { isAllowedSyncIntervalMs } from "../intervalPresets.js";
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
        (providerName
          ? config.aiProviders.find((p) => p.name === providerName)
          : undefined) ??
        config.aiProviders.find((p) => p.name === config.defaultProvider) ??
        config.aiProviders[0];
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
      const exportSettings = await deps.getExportConfig();
      const zoteroLocal = await loadZoteroLocalConfig(deps.repoRoot);
      const agents = await loadProviders(deps.repoRoot);
      response.json({
        gitSync: {
          ...gitSync,
          status: deps.getGitSyncState(),
        },
        export: {
          ...exportSettings,
          status: deps.getAutoExportState(),
        },
        zoteroLocal,
        agents,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings/git-sync", async (request, response, next) => {
    try {
      const { autoSync, intervalMs } = request.body ?? {};
      if (autoSync !== undefined && typeof autoSync !== "boolean") {
        response.status(400).json({ error: "autoSync must be a boolean" });
        return;
      }
      if (intervalMs !== undefined) {
        if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs)) {
          response.status(400).json({ error: "intervalMs must be a number" });
          return;
        }
        if (!isAllowedSyncIntervalMs(intervalMs)) {
          response.status(400).json({ error: "intervalMs must be a supported preset interval" });
          return;
        }
      }
      if (autoSync === undefined && intervalMs === undefined) {
        response.status(400).json({ error: "No git sync settings provided" });
        return;
      }
      await saveGitSyncPreferences(deps.repoRoot, {
        ...(autoSync !== undefined ? { autoSync } : {}),
        ...(intervalMs !== undefined ? { intervalMs } : {}),
      });
      deps.reloadGitSyncSchedule?.();
      const config = await deps.getGitSyncConfig();
      response.json(config);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings/export", async (request, response, next) => {
    try {
      const {
        autoExport,
        includeDrafts,
        pushOverleaf,
        debounceMs,
        blockOnOrphanRefs,
        blockOnUnapproved,
        blockOnMissingCitations,
      } = request.body ?? {};
      if (
        autoExport !== undefined &&
        typeof autoExport !== "boolean"
      ) {
        response.status(400).json({ error: "autoExport must be a boolean" });
        return;
      }
      if (
        includeDrafts !== undefined &&
        typeof includeDrafts !== "boolean"
      ) {
        response.status(400).json({ error: "includeDrafts must be a boolean" });
        return;
      }
      if (
        pushOverleaf !== undefined &&
        typeof pushOverleaf !== "boolean"
      ) {
        response.status(400).json({ error: "pushOverleaf must be a boolean" });
        return;
      }
      if (debounceMs !== undefined) {
        if (typeof debounceMs !== "number" || !Number.isFinite(debounceMs)) {
          response.status(400).json({ error: "debounceMs must be a number" });
          return;
        }
        if (!isAllowedExportDebounceMs(debounceMs)) {
          response.status(400).json({ error: "debounceMs must be a supported preset interval" });
          return;
        }
      }
      if (blockOnOrphanRefs !== undefined && typeof blockOnOrphanRefs !== "boolean") {
        response.status(400).json({ error: "blockOnOrphanRefs must be a boolean" });
        return;
      }
      if (blockOnUnapproved !== undefined && typeof blockOnUnapproved !== "boolean") {
        response.status(400).json({ error: "blockOnUnapproved must be a boolean" });
        return;
      }
      if (blockOnMissingCitations !== undefined && typeof blockOnMissingCitations !== "boolean") {
        response.status(400).json({ error: "blockOnMissingCitations must be a boolean" });
        return;
      }
      if (
        autoExport === undefined &&
        includeDrafts === undefined &&
        pushOverleaf === undefined &&
        debounceMs === undefined &&
        blockOnOrphanRefs === undefined &&
        blockOnUnapproved === undefined &&
        blockOnMissingCitations === undefined
      ) {
        response.status(400).json({ error: "No export settings provided" });
        return;
      }
      await saveExportPreferences(deps.repoRoot, {
        ...(autoExport !== undefined ? { autoExport } : {}),
        ...(includeDrafts !== undefined ? { includeDrafts } : {}),
        ...(pushOverleaf !== undefined ? { pushOverleaf } : {}),
        ...(debounceMs !== undefined ? { debounceMs } : {}),
        ...(blockOnOrphanRefs !== undefined ? { blockOnOrphanRefs } : {}),
        ...(blockOnUnapproved !== undefined ? { blockOnUnapproved } : {}),
        ...(blockOnMissingCitations !== undefined ? { blockOnMissingCitations } : {}),
      });
      const config = await deps.getExportConfig();
      response.json({
        ...config,
        status: deps.getAutoExportState(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/export/auto-status", async (_request, response) => {
    response.json({
      ...(await deps.getExportConfig()),
      status: deps.getAutoExportState(),
    });
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
