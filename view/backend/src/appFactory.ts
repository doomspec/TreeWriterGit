import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";
import cors from "cors";
import express, { type Express } from "express";
import { WebSocket, WebSocketServer } from "ws";

import { createGitSyncRunner } from "./gitSyncRunner.js";
import { loadGitSyncConfig, type GitSyncConfig } from "./gitSyncConfig.js";
import { createAutoExportRunner } from "./autoExportRunner.js";
import { loadExportConfig, type ExportConfig, type AutoExportRuntimeState } from "./exportConfig.js";
import { loadZoteroLocalConfig, type ZoteroLocalConfig } from "./zoteroLocalConfig.js";
import { resetServerMemoryState } from "./devReset.js";
import { handleExternalManuscriptWrite } from "./draftApproval.js";
import { createModelEventBroadcaster } from "./modelEvents.js";
import { ModelFsError } from "./modelFs.js";
import { createAgentJobManager, type AgentJobManager } from "./agentJobManager.js";
import { registerAppRoutes } from "./app/registerRoutes.js";
import { attachWebSocketUpgrade } from "./app/registerWebSockets.js";
import type { ServerDeps } from "./routes/types.js";
import {
  createTerminalSessionManager,
  parseTerminalConnectParams,
  type TerminalSessionManager,
} from "./terminalSessions.js";
import { parseTerminalClientMessage } from "./terminalMessages.js";

export type AppConfig = {
  repoRoot: string;
  modelRoot: string;
  corsOrigin?: string;
  gitSyncEnabled?: boolean;
  enableModelWatch?: boolean;
  terminalCommand?: string;
  terminalScriptPath: string;
  shell?: string;
  shellArgs?: string[];
};

export type AppRuntime = {
  app: Express;
  deps: ServerDeps;
  modelEventClients: Set<WebSocket>;
  terminalSessions: TerminalSessionManager;
  terminalServer: WebSocketServer;
  modelEventsServer: WebSocketServer;
  gitSyncConfigCache: { current: GitSyncConfig | null };
  exportConfigCache: { current: ExportConfig | null };
  zoteroLocalConfigCache: { current: ZoteroLocalConfig | null };
  autoExportState: AutoExportRuntimeState;
  stopWatch?: () => void;
  stopGitSyncInterval?: () => void;
  stopAutoExport?: () => void;
  agentJobs: AgentJobManager;
};

function defaultShellArgs(shell: string): string[] {
  if (shell.endsWith("zsh")) return ["-f", "-i"];
  if (shell.endsWith("bash")) return ["--noprofile", "--norc", "-i"];
  return ["-i"];
}

export function createApp(config: AppConfig): AppRuntime {
  const {
    repoRoot,
    modelRoot,
    corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173",
    gitSyncEnabled = process.env.GIT_SYNC_ENABLED !== "false",
    enableModelWatch = process.env.MODEL_WATCH_ENABLED !== "false",
    terminalCommand = process.env.TREEWRITER_TERMINAL_COMMAND ?? "python3",
    terminalScriptPath,
    shell = process.env.TREEWRITER_SHELL ?? "/bin/zsh",
    shellArgs = defaultShellArgs(process.env.TREEWRITER_SHELL ?? "/bin/zsh"),
  } = config;

  const gitSyncConfigCache = { current: null as GitSyncConfig | null };
  const getGitSyncConfig = async (): Promise<GitSyncConfig> => {
    gitSyncConfigCache.current = await loadGitSyncConfig(repoRoot);
    return gitSyncConfigCache.current;
  };
  const invalidateGitSyncConfig = (): void => {
    gitSyncConfigCache.current = null;
  };

  const exportConfigCache = { current: null as ExportConfig | null };
  const getExportConfig = async (): Promise<ExportConfig> => {
    exportConfigCache.current = await loadExportConfig(repoRoot);
    return exportConfigCache.current;
  };

  const zoteroLocalConfigCache = { current: null as ZoteroLocalConfig | null };
  const getZoteroLocalConfig = async (): Promise<ZoteroLocalConfig> => {
    zoteroLocalConfigCache.current = await loadZoteroLocalConfig(repoRoot);
    return zoteroLocalConfigCache.current;
  };
  const invalidateZoteroLocalConfig = (): void => {
    zoteroLocalConfigCache.current = null;
  };

  const { state: gitSyncState, runGitSync } = createGitSyncRunner(repoRoot, gitSyncEnabled, getGitSyncConfig);
  const agentJobs = createAgentJobManager();

  const app = express();
  app.use(cors({ origin: corsOrigin }));

  const json25mb = express.json({ limit: "25mb" });
  app.use("/api/model/figure/upload", json25mb);
  app.use("/api/model/references/import", json25mb);
  app.use("/api/model/bib/import", json25mb);
  app.use("/api/import/docx", json25mb);
  app.use(express.json({ limit: "2mb" }));

  const wsToken = process.env.TREEWRITER_WS_TOKEN?.trim();
  const apiToken =
    process.env.TREEWRITER_REST_AUTH === "true" ? wsToken : undefined;
  if (apiToken) {
    app.use((request, response, next) => {
      if (request.path === "/health") {
        next();
        return;
      }
      const headerToken = request.headers["x-treewriter-token"];
      const queryToken = request.query.token;
      const token =
        (typeof headerToken === "string" ? headerToken : "") ||
        (typeof queryToken === "string" ? queryToken : "");
      if (token !== apiToken) {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }

  const modelEventClients = new Set<WebSocket>();
  const baseBroadcastModelEvent = createModelEventBroadcaster(
    modelEventClients,
    WebSocket.OPEN,
    modelRoot,
  );
  const autoExportRunner = createAutoExportRunner({
    modelRoot,
    repoRoot,
    getExportConfig,
  });
  const broadcastModelEvent: typeof baseBroadcastModelEvent = (event, source) => {
    baseBroadcastModelEvent(event, source);
    if (typeof event.path === "string") {
      autoExportRunner.scheduleAutoExport(event.path);
    }
  };

  const deps: ServerDeps = {
    modelRoot,
    repoRoot,
    broadcastModelEvent,
    getGitSyncState: () => gitSyncState,
    runGitSync,
    getGitSyncConfig,
    getExportConfig,
    getZoteroLocalConfig,
    invalidateZoteroLocalConfig,
    getAutoExportState: () => autoExportRunner.state,
    runAutoExportNow: autoExportRunner.runAutoExportNow,
    reloadGitSyncSchedule: () => scheduleGitSyncInterval(),
    agentJobs,
  };

  registerAppRoutes(app, deps);

  const terminalSessions = createTerminalSessionManager({
    command: terminalCommand,
    args: [terminalScriptPath, modelRoot, shell, ...shellArgs],
    cwd: modelRoot,
    env: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      HISTFILE: "/dev/null",
      BASH_SILENCE_DEPRECATION_WARNING: "1",
    },
  });

  const devEndpointsEnabled =
    process.env.NODE_ENV !== "production" || process.env.TREEWRITER_DEV_ENDPOINTS === "true";

  if (devEndpointsEnabled) {
    app.post("/api/dev/reset", (_request, response) => {
      response.json(resetServerMemoryState({ terminalSessions }));
    });
  }

  app.use(
    (error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
      const status = error instanceof ModelFsError ? error.status : 500;
      response.status(status).json({
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );

  const terminalServer = new WebSocketServer({ noServer: true });
  const modelEventsServer = new WebSocketServer({ noServer: true });

  modelEventsServer.on("connection", (socket) => {
    modelEventClients.add(socket);
    socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
    socket.on("close", () => modelEventClients.delete(socket));
  });

  terminalServer.on("connection", (socket, request) => {
    const { sessionId, forceNew, replayScrollback } = parseTerminalConnectParams(
      request.url ?? "/terminal",
    );
    let session;
    try {
      session = terminalSessions.resolveSession(sessionId, forceNew);
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to start terminal session",
        }),
      );
      socket.close();
      return;
    }
    terminalSessions.attach(socket, session, { replayScrollback });

    socket.on("message", (rawMessage) => {
      const message = parseTerminalClientMessage(rawMessage.toString());
      if (!message) return;
      if (message.type === "input") {
        terminalSessions.handleInput(session, message.data);
        return;
      }
      if (message.type === "resize") {
        terminalSessions.handleResize(session, message.cols, message.rows);
      }
    });

    socket.on("close", () => {
      terminalSessions.detach(session);
    });
  });

  let stopWatch: (() => void) | undefined;
  if (enableModelWatch) {
    let watchDebounce: NodeJS.Timeout | undefined;
    const watcher = fs.watch(modelRoot, { recursive: true }, (_eventType, filename) => {
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        void (async () => {
          const fileRel = filename?.toString() ?? null;
          if (fileRel) {
            for (const sidePath of await handleExternalManuscriptWrite(modelRoot, fileRel, {
              repoRoot,
              agentJobs,
            })) {
              broadcastModelEvent({ type: "model-changed", path: sidePath });
            }
          }
          broadcastModelEvent({ type: "model-changed", path: fileRel }, "watch");
        })();
      }, 250);
    });
    stopWatch = () => {
      clearTimeout(watchDebounce);
      watcher.close();
    };
  }

  let stopGitSyncInterval: (() => void) | undefined;
  let gitSyncTimer: ReturnType<typeof setTimeout> | undefined;
  let gitSyncScheduleGeneration = 0;

  const scheduleGitSyncInterval = (): void => {
    if (!gitSyncEnabled) return;
    gitSyncScheduleGeneration += 1;
    const generation = gitSyncScheduleGeneration;
    clearTimeout(gitSyncTimer);
    void (async () => {
      invalidateGitSyncConfig();
      const config = await getGitSyncConfig();
      if (generation !== gitSyncScheduleGeneration) return;
      gitSyncTimer = setTimeout(() => {
        void (async () => {
          const latest = await getGitSyncConfig();
          if (latest.autoSync) {
            await runGitSync("interval");
          }
          if (generation === gitSyncScheduleGeneration) {
            scheduleGitSyncInterval();
          }
        })();
      }, config.intervalMs);
    })();
  };

  if (gitSyncEnabled) {
    scheduleGitSyncInterval();
    stopGitSyncInterval = () => {
      gitSyncScheduleGeneration += 1;
      clearTimeout(gitSyncTimer);
    };
  }

  return {
    app,
    deps,
    modelEventClients,
    terminalSessions,
    terminalServer,
    modelEventsServer,
    gitSyncConfigCache,
    exportConfigCache,
    zoteroLocalConfigCache,
    autoExportState: autoExportRunner.state,
    stopWatch,
    stopGitSyncInterval,
    stopAutoExport: autoExportRunner.dispose,
    agentJobs,
  };
}

export type HttpServerRuntime = AppRuntime & {
  server: Server;
  port: number;
  close: () => Promise<void>;
};

export { attachWebSocketUpgrade } from "./app/registerWebSockets.js";

export function createServer(config: AppConfig, port = Number(process.env.PORT ?? 4000)): HttpServerRuntime {
  const runtime = createApp(config);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = runtime.app.listen(port, host);
  attachWebSocketUpgrade(runtime, server);

  const close = () =>
    new Promise<void>((resolve, reject) => {
      runtime.stopWatch?.();
      runtime.stopGitSyncInterval?.();
      runtime.stopAutoExport?.();
      runtime.terminalServer.close();
      runtime.modelEventsServer.close();
      server.close((error) => (error ? reject(error) : resolve()));
    });

  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address && "port" in address ? address.port : port;

  return { ...runtime, server, port: resolvedPort, close };
}

export function resolveDefaultPaths(moduleDir: string): { repoRoot: string; modelRoot: string; terminalScriptPath: string } {
  const repoRoot = path.resolve(moduleDir, "../../..");
  return {
    repoRoot,
    modelRoot: path.join(repoRoot, "model"),
    terminalScriptPath: path.join(moduleDir, "pty_bridge.py"),
  };
}
