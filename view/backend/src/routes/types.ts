import type { Express } from "express";

import type { GitSyncConfig } from "../gitSyncConfig.js";
import type { ExportConfig, AutoExportRuntimeState } from "../exportConfig.js";
import type { ZoteroLocalConfig } from "../zoteroLocalConfig.js";
import type { GitSyncState } from "../gitSyncRunner.js";
import type { AgentJobManager } from "../agentJobManager.js";

export type ServerDeps = {
  modelRoot: string;
  repoRoot: string;
  broadcastModelEvent: (event: Record<string, unknown>) => void;
  getGitSyncState: () => GitSyncState;
  runGitSync: (reason?: string) => Promise<GitSyncState>;
  getGitSyncConfig: () => Promise<GitSyncConfig>;
  getExportConfig: () => Promise<ExportConfig>;
  getZoteroLocalConfig: () => Promise<ZoteroLocalConfig>;
  invalidateZoteroLocalConfig?: () => void;
  getAutoExportState: () => AutoExportRuntimeState;
  runAutoExportNow: (paperSlug: string) => Promise<void>;
  reloadGitSyncSchedule?: () => void;
  agentJobs?: AgentJobManager;
};

export type RouteRegistrar = (app: Express, deps: ServerDeps) => void;
