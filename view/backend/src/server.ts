import path from "node:path";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";

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

type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: ModelNode[];
};

type GitSyncState = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutput: string | null;
  conflictDetected: boolean;
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
  ...shellArgs
];
const execFileAsync = promisify(execFile);
const gitSyncState: GitSyncState = {
  enabled: gitSyncEnabled,
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastOutput: null,
  conflictDetected: false
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function toModelPath(relativePath: string) {
  const normalized = path.normalize(relativePath || ".").replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(modelRoot, normalized);

  if (absolutePath !== modelRoot && !absolutePath.startsWith(`${modelRoot}${path.sep}`)) {
    throw new Error("Path escapes model root");
  }

  return absolutePath;
}

function toRelativeModelPath(absolutePath: string) {
  return path.relative(modelRoot, absolutePath).split(path.sep).join("/");
}

async function readModelTree(directory = modelRoot): Promise<ModelNode[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = toRelativeModelPath(absolutePath);

        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: relativePath,
            type: "directory" as const,
            children: await readModelTree(absolutePath)
          };
        }

        return {
          name: entry.name,
          path: relativePath,
          type: "file" as const
        };
      })
  );

  return nodes;
}

async function git(args: string[]) {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024
  });

  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

async function runGitSync(reason = "interval") {
  if (!gitSyncEnabled || gitSyncState.running) {
    return gitSyncState;
  }

  gitSyncState.running = true;
  gitSyncState.lastRunAt = new Date().toISOString();
  gitSyncState.lastError = null;

  try {
    const output: string[] = [`sync reason: ${reason}`];
    const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    output.push(await git(["fetch", "origin"]));

    const modelStatus = await git(["status", "--porcelain", "--", "model"]);
    if (modelStatus) {
      output.push(await git(["add", "model"]));
      output.push(await git(["commit", "-m", "Automated sync"]));
    }

    let remoteBranchExists = false;
    try {
      await git(["rev-parse", "--verify", "--quiet", `origin/${branch}`]);
      remoteBranchExists = true;
    } catch {
      remoteBranchExists = false;
    }

    if (remoteBranchExists) {
      try {
        output.push(await git(["rebase", `origin/${branch}`]));
        gitSyncState.conflictDetected = false;
      } catch (rebaseError) {
        await git(["rebase", "--abort"]).catch(() => {});
        gitSyncState.conflictDetected = true;
        throw new Error(
          "Rebase conflict — aborted; resolve manually in the terminal, then run sync again."
        );
      }
    } else {
      gitSyncState.conflictDetected = false;
    }

    output.push(await git(["push", "origin", `HEAD:${branch}`]));

    gitSyncState.lastSuccessAt = new Date().toISOString();
    gitSyncState.lastOutput = output.filter(Boolean).join("\n");
  } catch (error) {
    gitSyncState.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    gitSyncState.running = false;
  }

  return gitSyncState;
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    modelRoot,
    gitSync: gitSyncState
  });
});

app.get("/api/model/tree", async (_request, response, next) => {
  try {
    response.json({
      root: "model",
      tree: await readModelTree()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/file", async (request, response, next) => {
  try {
    const relativePath = String(request.query.path ?? "");
    const absolutePath = toModelPath(relativePath);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      response.status(400).json({ error: "Path is not a file" });
      return;
    }

    response.json({
      path: relativePath,
      content: await readFile(absolutePath, "utf8"),
      updatedAt: fileStat.mtime.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/model/file", async (request, response, next) => {
  try {
    const relativePath = String(request.body?.path ?? "");
    const content = String(request.body?.content ?? "");
    const absolutePath = toModelPath(relativePath);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      response.status(400).json({ error: "Path is not a file" });
      return;
    }

    await writeFile(absolutePath, content, "utf8");
    broadcastModelEvent({ type: "model-changed", path: relativePath });

    response.json({
      ok: true,
      path: relativePath
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/git-sync/status", (_request, response) => {
  response.json(gitSyncState);
});

app.post("/api/git-sync/run", async (_request, response) => {
  response.json(await runGitSync("manual"));
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(500).json({
    error: error instanceof Error ? error.message : String(error)
  });
});

const server = app.listen(port, () => {
  console.log(`TreeWriter backend listening on http://localhost:${port}`);
  console.log(`Terminal working directory: ${modelRoot}`);
  console.log(
    gitSyncEnabled
      ? `Git sync enabled every ${Math.round(gitSyncIntervalMs / 1000)}s`
      : "Git sync disabled"
  );
});

const terminalServer = new WebSocketServer({ noServer: true });

const modelEventsServer = new WebSocketServer({ noServer: true });

const modelEventClients = new Set<WebSocket>();

function broadcastModelEvent(event: Record<string, unknown>) {
  const payload = JSON.stringify({
    ...event,
    at: new Date().toISOString()
  });

  for (const client of modelEventClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

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
      path: filename?.toString() ?? null
    });
  }, 100);
});

if (gitSyncEnabled) {
  setInterval(() => {
    void runGitSync("interval");
  }, gitSyncIntervalMs);
}

terminalServer.on("connection", (socket) => {
  const term = spawn(terminalCommand, terminalArgs, {
    cwd: modelRoot,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      HISTFILE: "/dev/null",
      BASH_SILENCE_DEPRECATION_WARNING: "1"
    },
    stdio: ["pipe", "pipe", "pipe", "pipe"]
  });

  const controlFd = term.stdio[3] as NodeJS.WritableStream | null;

  term.stdout.on("data", (data: Buffer) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data.toString());
    }
  });

  term.stderr.on("data", (data: Buffer) => {
    const text = data
      .toString()
      .replace("bash: no job control in this shell\n", "")
      .replace(/\r?\nThe default interactive shell is now zsh\.[\s\S]*?HT208050\.\r?\n/, "");
    if (!text) {
      return;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(text);
    }
  });

  term.on("exit", (exitCode) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(`\r\n[process exited with code ${exitCode ?? "unknown"}]\r\n`);
      socket.close();
    }
  });

  term.on("error", (error) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(`\r\n[failed to start shell: ${error.message}]\r\n`);
      socket.close();
    }
  });

  socket.on("message", (rawMessage) => {
    const text = rawMessage.toString();
    let message: ClientMessage;

    try {
      message = JSON.parse(text) as ClientMessage;
    } catch {
      return;
    }

    if (message.type === "input") {
      term.stdin.write(message.data);
      return;
    }

    if (message.type === "resize") {
      const { cols, rows } = message;
      if (controlFd && Number.isFinite(cols) && Number.isFinite(rows)) {
        controlFd.write(`${JSON.stringify({ t: "resize", cols, rows })}\n`);
      }
    }
  });

  socket.on("close", () => {
    term.kill();
  });
});
