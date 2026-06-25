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
import { resetServerMemoryState } from "./devReset.js";
import { createModelEventBroadcaster } from "./modelEvents.js";
import { ModelFsError } from "./modelFs.js";
import {
  registerAgentRoutes,
  registerCommentsRoutes,
  registerExportRoutes,
  registerModelRoutes,
  registerPapersRoutes,
  registerPresenceRoutes,
  registerSettingsRoutes,
} from "./routes/index.js";
import { registerModelAssetRoutes } from "./routes/model/assets.js";
import type { ServerDeps } from "./routes/types.js";
import {
  createTerminalSessionManager,
  parseTerminalConnectParams,
  type TerminalSessionManager,
} from "./terminalSessions.js";
import { parseTerminalClientMessage } from "./terminalMessages.js";
import { createAgentJobManager, type AgentJobManager } from "./agentJobManager.js";

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

  const { state: gitSyncState, runGitSync } = createGitSyncRunner(repoRoot, gitSyncEnabled, getGitSyncConfig);
  const agentJobs = createAgentJobManager();

  const app = express();
  app.use(cors({ origin: corsOrigin }));

  const json25mb = express.json({ limit: "25mb" });
  app.use("/api/model/figure/upload", json25mb);
  app.use("/api/model/references/import", json25mb);
  app.use(express.json({ limit: "2mb" }));

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
    getAutoExportState: () => autoExportRunner.state,
    runAutoExportNow: autoExportRunner.runAutoExportNow,
    reloadGitSyncSchedule: () => scheduleGitSyncInterval(),
    agentJobs,
  };

  registerSettingsRoutes(app, deps);
  registerCommentsRoutes(app, deps);
  registerPresenceRoutes(app, deps);
  registerPapersRoutes(app, deps);
  registerExportRoutes(app, deps);
  registerAgentRoutes(app, deps);
  registerModelAssetRoutes(app, deps);
  registerModelRoutes(app, deps);

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
    const { sessionId, forceNew } = parseTerminalConnectParams(request.url ?? "/terminal");
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
    terminalSessions.attach(socket, session);

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
        broadcastModelEvent(
          { type: "model-changed", path: filename?.toString() ?? null },
          "watch",
        );
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

export function attachWebSocketUpgrade(runtime: AppRuntime, server: Server): void {
  const wsToken = process.env.TREEWRITER_WS_TOKEN?.trim();
  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (wsToken) {
      const token =
        requestUrl.searchParams.get("token") ??
        (typeof request.headers["x-treewriter-token"] === "string"
          ? request.headers["x-treewriter-token"]
          : "");
      if (token !== wsToken) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    const websocketServer =
      requestUrl.pathname === "/terminal"
        ? runtime.terminalServer
        : requestUrl.pathname === "/model-events"
          ? runtime.modelEventsServer
          : null;

    if (!websocketServer) {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });
}

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
