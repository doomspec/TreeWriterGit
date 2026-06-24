import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";

import { createApp, type AppConfig, type AppRuntime } from "../appFactory.js";
import type { ServerDeps } from "../routes/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultModuleDir = path.resolve(__dirname, "..");

export type TestAppOptions = Partial<AppConfig> & {
  modelRoot?: string;
  repoRoot?: string;
};

export function createTestDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    modelRoot: overrides.modelRoot ?? path.join(process.cwd(), "model"),
    repoRoot: overrides.repoRoot ?? process.cwd(),
    broadcastModelEvent: overrides.broadcastModelEvent ?? (() => {}),
    getGitSyncState:
      overrides.getGitSyncState ??
      (() => ({
        enabled: false,
        running: false,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastOutput: null,
        conflictDetected: false,
        pendingStashRestore: false,
        viewChangesBlocked: false,
      })),
    runGitSync:
      overrides.runGitSync ??
      (async () => ({
        enabled: false,
        running: false,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastOutput: null,
        conflictDetected: false,
        pendingStashRestore: false,
        viewChangesBlocked: false,
      })),
    getGitSyncConfig:
      overrides.getGitSyncConfig ??
      (async () => ({
        enabled: false,
        autoSync: false,
        intervalMs: 120_000,
        commitPaths: ["model"],
        excludePaths: ["view"],
      })),
    getExportConfig:
      overrides.getExportConfig ??
      (async () => ({
        autoExport: false,
        includeDrafts: true,
        pushOverleaf: true,
        debounceMs: 60_000,
      })),
    getAutoExportState:
      overrides.getAutoExportState ??
      (() => ({
        running: false,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastPaperSlug: null,
        lastMessage: null,
      })),
    runAutoExportNow: overrides.runAutoExportNow ?? (async () => {}),
    reloadGitSyncSchedule: overrides.reloadGitSyncSchedule ?? (() => {}),
    ...overrides,
  };
}

/** Express app with all routes; no port bind, no fs.watch by default. */
export function createTestApp(options: TestAppOptions = {}): AppRuntime {
  const repoRoot = options.repoRoot ?? path.join(process.cwd(), "test-fixtures");
  const modelRoot = options.modelRoot ?? path.join(repoRoot, "model");
  return createApp({
    repoRoot,
    modelRoot,
    terminalScriptPath: path.join(defaultModuleDir, "pty_bridge.py"),
    enableModelWatch: false,
    gitSyncEnabled: false,
    ...options,
  });
}

export type TestServerHandle = AppRuntime & {
  server: Server;
  port: number;
  close: () => Promise<void>;
};

export function createTestServer(options: TestAppOptions = {}): TestServerHandle {
  const runtime = createTestApp(options);
  const server = runtime.app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const close = () =>
    new Promise<void>((resolve, reject) => {
      runtime.stopWatch?.();
      runtime.stopGitSyncInterval?.();
      runtime.stopAutoExport?.();
      server.close((error) => (error ? reject(error) : resolve()));
    });

  return { ...runtime, server, port, close };
}
