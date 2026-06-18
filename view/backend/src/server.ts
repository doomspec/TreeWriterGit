import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";

import { createGitSyncRunner } from "./gitSyncRunner.js";
import { loadGitSyncConfig, type GitSyncConfig } from "./gitSyncConfig.js";
import { invalidateGraphCache } from "./graphCache.js";
import { ModelFsError, resolveModelPath } from "./modelFs.js";
import { uploadFigureImage } from "./figures.js";
import {
  registerAgentRoutes,
  registerCommentsRoutes,
  registerExportRoutes,
  registerModelRoutes,
  registerPapersRoutes,
  registerPresenceRoutes,
  registerSettingsRoutes,
} from "./routes/index.js";
import {
  createTerminalSessionManager,
  parseTerminalConnectParams,
} from "./terminalSessions.js";

type ClientMessage =
  | {
      type: "input";
      data: string;
    }
  | {
      type: "resize";
      cols: number;
      rows: number;
    };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const modelRoot = path.join(repoRoot, "model");
const port = Number(process.env.PORT ?? 4000);
const gitSyncIntervalMs = Number(process.env.GIT_SYNC_INTERVAL_MS ?? 120_000);
const gitSyncEnabled = process.env.GIT_SYNC_ENABLED !== "false";
const shell = process.env.TREEWRITER_SHELL ?? "/bin/zsh";
const shellArgs = shell.endsWith("zsh")
  ? ["-f", "-i"]
  : shell.endsWith("bash")
    ? ["--noprofile", "--norc", "-i"]
    : ["-i"];
const terminalCommand = process.env.TREEWRITER_TERMINAL_COMMAND ?? "python3";
const terminalArgs = [
  path.join(__dirname, "pty_bridge.py"),
  modelRoot,
  shell,
  ...shellArgs,
];

let gitSyncConfigCache: GitSyncConfig | null = null;

async function getGitSyncConfig(): Promise<GitSyncConfig> {
  gitSyncConfigCache = await loadGitSyncConfig(repoRoot);
  return gitSyncConfigCache;
}

const { state: gitSyncState, runGitSync } = createGitSyncRunner(repoRoot, gitSyncEnabled);

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: corsOrigin }));

app.post("/api/model/figure/upload", express.json({ limit: "25mb" }), async (request, response, next) => {
  try {
    const figurePath = String(request.body?.path ?? "").trim();
    const filename = String(request.body?.filename ?? "preview.png");
    const dataBase64 = String(request.body?.data ?? "");
    if (!figurePath) {
      response.status(400).json({ error: "path is required" });
      return;
    }
    if (!dataBase64) {
      response.status(400).json({ error: "data is required" });
      return;
    }
    resolveModelPath(modelRoot, figurePath.replace(/\.md$/, ""));
    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length === 0) {
      response.status(400).json({ error: "Empty file data" });
      return;
    }
    if (buffer.length > 20 * 1024 * 1024) {
      response.status(400).json({ error: "File too large (max 20MB)" });
      return;
    }
    const result = await uploadFigureImage(modelRoot, figurePath, filename, buffer);
    broadcastModelEvent({ type: "model-changed", path: result.assetPath });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.use(express.json({ limit: "2mb" }));

const modelEventClients = new Set<WebSocket>();

function broadcastModelEvent(event: Record<string, unknown>) {
  invalidateGraphCache();
  const payload = JSON.stringify({
    ...event,
    at: new Date().toISOString(),
  });

  for (const client of modelEventClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const deps = {
  modelRoot,
  repoRoot,
  broadcastModelEvent,
  getGitSyncState: () => gitSyncState,
  runGitSync,
  getGitSyncConfig,
};

registerSettingsRoutes(app, deps);
registerCommentsRoutes(app, deps);
registerPresenceRoutes(app, deps);
registerPapersRoutes(app, deps);
registerExportRoutes(app, deps);
registerAgentRoutes(app, deps);
registerModelRoutes(app, deps);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = error instanceof ModelFsError ? error.status : 500;
  response.status(status).json({
    error: error instanceof Error ? error.message : String(error),
  });
});

const server = app.listen(port, () => {
  console.log(`TreeWriter backend listening on http://localhost:${port}`);
  console.log(`Terminal working directory: ${modelRoot}`);
  console.log(
    gitSyncEnabled
      ? `Git sync enabled every ${Math.round(gitSyncIntervalMs / 1000)}s`
      : "Git sync disabled",
  );
});

const terminalServer = new WebSocketServer({ noServer: true });

const terminalSessions = createTerminalSessionManager({
  command: terminalCommand,
  args: terminalArgs,
  cwd: modelRoot,
  env: {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    HISTFILE: "/dev/null",
    BASH_SILENCE_DEPRECATION_WARNING: "1",
  },
});

const modelEventsServer = new WebSocketServer({ noServer: true });

modelEventsServer.on("connection", (socket) => {
  modelEventClients.add(socket);
  socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
  socket.on("close", () => modelEventClients.delete(socket));
});

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const websocketServer =
    requestUrl.pathname === "/terminal"
      ? terminalServer
      : requestUrl.pathname === "/model-events"
        ? modelEventsServer
        : null;

  if (!websocketServer) {
    socket.destroy();
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit("connection", websocket, request);
  });
});

let watchDebounce: NodeJS.Timeout | undefined;
fs.watch(modelRoot, { recursive: true }, (_eventType, filename) => {
  clearTimeout(watchDebounce);
  watchDebounce = setTimeout(() => {
    broadcastModelEvent({
      type: "model-changed",
      path: filename?.toString() ?? null,
    });
  }, 100);
});

if (gitSyncEnabled) {
  void getGitSyncConfig();
  setInterval(() => {
    void (async () => {
      const config = gitSyncConfigCache ?? (await getGitSyncConfig());
      if (!config.autoSync) return;
      await runGitSync("interval");
    })();
  }, gitSyncIntervalMs);
}

terminalServer.on("connection", (socket, request) => {
  const { sessionId, forceNew } = parseTerminalConnectParams(request.url ?? "/terminal");
  const session = terminalSessions.resolveSession(sessionId, forceNew);
  terminalSessions.attach(socket, session);

  socket.on("message", (rawMessage) => {
    const text = rawMessage.toString();
    let message: ClientMessage;

    try {
      message = JSON.parse(text) as ClientMessage;
    } catch {
      return;
    }

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
