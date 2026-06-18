import type { Express } from "express";

import type { GitSyncConfig } from "../gitSyncConfig.js";
import type { GitSyncState } from "../gitSyncRunner.js";

export type ServerDeps = {
  modelRoot: string;
  repoRoot: string;
  broadcastModelEvent: (event: Record<string, unknown>) => void;
  getGitSyncState: () => GitSyncState;
  runGitSync: (reason?: string) => Promise<GitSyncState>;
  getGitSyncConfig: () => Promise<GitSyncConfig>;
};

export type RouteRegistrar = (app: Express, deps: ServerDeps) => void;
