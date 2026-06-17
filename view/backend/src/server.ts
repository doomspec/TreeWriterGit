import path from "node:path";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";

import {
  ModelFsError,
  createFile,
  createNode,
  deleteNode,
  moveNode,
  reorderChildren,
  materializeOutline,
  materializeDraft,
  resolveModelPath,
  type NodeKind
} from "./modelFs.js";
import { buildGraph } from "./graph.js";
import { getCachedGraph, invalidateGraphCache } from "./graphCache.js";
import { searchModel, validateSearchQuery } from "./search.js";
import { composeSectionView } from "./compose.js";
import { loadProviders, buildPreview, buildFanOutPreviews, listContextCandidates, type DispatchAction } from "./agentDispatch.js";
import { listSessions, createSession, updateSessionStatus, advanceUnitStatusOnSessionComplete } from "./sessions.js";
import {
  scaffoldPaper,
  listPapers,
  getPaperDetail,
  listJournalTemplates,
} from "./papers.js";
import { exportPaper, exportPaperBatch, resolveExportDownload } from "./export.js";
import { pushToOverleaf, importOverleafFeedback } from "./overleaf.js";
import {
  createComment,
  deleteComment,
  listComments,
  summarizeCommentsForPaper,
  updateComment,
} from "./comments.js";
import {
  claimPresence,
  getPresence,
  heartbeatPresence,
  releasePresence,
} from "./presence.js";
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
  pendingStashRestore: boolean;
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
  conflictDetected: false,
  pendingStashRestore: false
};

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: corsOrigin }));
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
  gitSyncState.pendingStashRestore = false;

  let stashCreated = false;

  try {
    const output: string[] = [`sync reason: ${reason}`];
    const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    output.push(await git(["fetch", "origin"]));

    const modelStatus = await git(["status", "--porcelain", "--", "model"]);
    if (modelStatus) {
      output.push(await git(["add", "model"]));
      output.push(await git(["commit", "-m", "Automated sync"]));
    }

    // Never stash view/ — local UI work must stay on disk. Stash other non-model paths only.
    const outsideModelView = await git([
      "status",
      "--porcelain",
      "--",
      ".",
      ":!model",
      ":!model/**",
      ":!view",
      ":!view/**",
    ]);
    if (outsideModelView) {
      output.push(
        await git([
          "stash",
          "push",
          "-m",
          "treewriter-sync-wip",
          "--",
          ".",
          ":!model",
          ":!model/**",
          ":!view",
          ":!view/**",
        ]),
      );
      stashCreated = true;
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
        const rebaseMessage =
          rebaseError instanceof Error ? rebaseError.message : String(rebaseError);
        const blockedByLocalChanges = /unstaged changes|uncommitted/i.test(rebaseMessage);
        if (!blockedByLocalChanges) {
          gitSyncState.conflictDetected = true;
        }
        throw new Error(
          blockedByLocalChanges
            ? "Sync paused — local view/ changes prevented rebase; model/ was committed. Commit view/ or sync manually."
            : "Rebase conflict — aborted; resolve manually in the terminal, then run sync again.",
        );
      }
    } else {
      gitSyncState.conflictDetected = false;
    }

    output.push(await git(["push", "origin", `HEAD:${branch}`]));

    if (stashCreated) {
      try {
        output.push(await git(["stash", "pop"]));
        stashCreated = false;
      } catch (popError) {
        const message = popError instanceof Error ? popError.message : String(popError);
        output.push(`stash pop failed: ${message}`);
        gitSyncState.pendingStashRestore = true;
        gitSyncState.lastError =
          "Model synced, but local view/ edits were left in git stash. In the repo root run: git stash pop";
      }
    }

    gitSyncState.lastSuccessAt = new Date().toISOString();
    gitSyncState.lastOutput = output.filter(Boolean).join("\n");
  } catch (error) {
    if (stashCreated) {
      try {
        await git(["stash", "pop"]);
      } catch {
        gitSyncState.pendingStashRestore = true;
        gitSyncState.lastError =
          "Sync failed and local view/ edits may still be in git stash. In the repo root run: git stash pop";
      }
    }
    if (!gitSyncState.lastError) {
      gitSyncState.lastError = error instanceof Error ? error.message : String(error);
    }
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
    let fileStat;
    try {
      fileStat = await stat(absolutePath);
    } catch (statError) {
      const errno = statError as NodeJS.ErrnoException;
      if (errno.code === "ENOENT") {
        if (relativePath === "outline.md" || relativePath.endsWith("/outline.md")) {
          const content = await materializeOutline(modelRoot, relativePath);
          response.json({
            path: relativePath,
            content,
            updatedAt: new Date().toISOString(),
          });
          return;
        }
        if (relativePath === "draft.md" || relativePath.endsWith("/draft.md")) {
          const content = await materializeDraft(modelRoot, relativePath);
          response.json({
            path: relativePath,
            content,
            updatedAt: new Date().toISOString(),
          });
          return;
        }
      }
      throw statError;
    }

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

app.post("/api/model/file", async (request, response, next) => {
  try {
    const relativePath = String(request.body?.path ?? "");
    const content = String(request.body?.content ?? "");
    const created = await createFile(modelRoot, relativePath, content);
    broadcastModelEvent({ type: "model-changed", path: created });
    response.status(201).json({ ok: true, path: created });
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/node", async (request, response, next) => {
  try {
    const parent = String(request.body?.parent ?? "");
    const name = String(request.body?.name ?? "");
    const kind = String(request.body?.kind ?? "") as NodeKind;
    if (!["section", "subsection", "unit"].includes(kind)) {
      response.status(400).json({ error: "kind must be section, subsection, or unit" });
      return;
    }
    const created = await createNode(modelRoot, parent, name, kind);
    broadcastModelEvent({ type: "model-changed", path: created });
    response.status(201).json({ ok: true, path: created, kind });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/model/file", async (request, response, next) => {
  try {
    const relativePath = String(request.query.path ?? "");
    const recursive = request.query.recursive === "true";
    await deleteNode(modelRoot, relativePath, recursive);
    broadcastModelEvent({ type: "model-changed", path: relativePath });
    response.json({ ok: true, path: relativePath });
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/move", async (request, response, next) => {
  try {
    const from = String(request.body?.from ?? "");
    const to = String(request.body?.to ?? "");
    await moveNode(modelRoot, from, to);
    broadcastModelEvent({ type: "model-changed", path: from });
    broadcastModelEvent({ type: "model-changed", path: to });
    response.json({ ok: true, from, to });
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/reorder", async (request, response, next) => {
  try {
    const parent = String(request.body?.parent ?? "");
    const childOrder = request.body?.child_order;
    await reorderChildren(modelRoot, parent, childOrder);
    broadcastModelEvent({ type: "model-changed", path: parent });
    response.json({ ok: true, parent });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/graph", async (request, response, next) => {
  try {
    const root = String(request.query.root ?? "");
    if (root) resolveModelPath(modelRoot, root);
    response.json(await getCachedGraph(modelRoot, root));
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/search", async (request, response, next) => {
  try {
    const q = validateSearchQuery(String(request.query.q ?? ""));
    const root = String(request.query.root ?? "");
    if (root) resolveModelPath(modelRoot, root);
    const limit = Math.min(Number(request.query.limit ?? 50) || 50, 100);
    response.json({ results: await searchModel(modelRoot, q, root, limit) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/section-compose", async (request, response, next) => {
  try {
    const pathParam = String(request.query.path ?? "");
    if (!pathParam) {
      response.status(400).json({ error: "path query parameter is required" });
      return;
    }
    resolveModelPath(modelRoot, pathParam);
    response.json(await composeSectionView(modelRoot, pathParam));
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent/providers", async (_request, response, next) => {
  try {
    response.json(await loadProviders(repoRoot));
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent/context", async (request, response, next) => {
  try {
    const unitPath = String(request.query.unitPath ?? "");
    const action = String(request.query.action ?? "draft") as DispatchAction;
    if (!unitPath) {
      response.status(400).json({ error: "unitPath required" });
      return;
    }
    resolveModelPath(modelRoot, unitPath);
    response.json({ files: await listContextCandidates(modelRoot, unitPath, action) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/agent/preview", async (request, response, next) => {
  try {
    const { unitPath, action, provider: providerName, customPrompt, sessionId, contextPaths } =
      request.body as {
        unitPath?: string;
        action?: string;
        provider?: string;
        customPrompt?: string;
        sessionId?: string;
        contextPaths?: string[];
      };
    if (!unitPath) {
      response.status(400).json({ error: "unitPath required" });
      return;
    }
    resolveModelPath(modelRoot, unitPath);
    const config = await loadProviders(repoRoot);
    const provider =
      config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      unitPath,
      (action ?? "draft") as DispatchAction,
      provider,
      customPrompt,
      sessionId,
      contextPaths,
    );
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/agent/fan-out", async (request, response, next) => {
  try {
    const { sectionPath, action, provider: providerName, customPrompt } = request.body as {
      sectionPath?: string;
      action?: string;
      provider?: string;
      customPrompt?: string;
    };
    if (!sectionPath) {
      response.status(400).json({ error: "sectionPath required" });
      return;
    }
    resolveModelPath(modelRoot, sectionPath);
    const config = await loadProviders(repoRoot);
    const provider =
      config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
    const units = await buildFanOutPreviews(
      modelRoot,
      repoRoot,
      sectionPath,
      (action ?? "draft") as DispatchAction,
      provider,
      customPrompt,
    );
    response.json({ units });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions", async (request, response, next) => {
  try {
    const unitPath = String(request.query.unitPath ?? "");
    if (!unitPath) {
      response.status(400).json({ error: "unitPath required" });
      return;
    }
    resolveModelPath(modelRoot, unitPath);
    response.json({ sessions: await listSessions(modelRoot, unitPath) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions", async (request, response, next) => {
  try {
    const { unitPath, provider, action, command, status, notes } = request.body as {
      unitPath?: string;
      provider?: string;
      action?: string;
      command?: string;
      status?: string;
      notes?: string;
    };
    if (!unitPath || !provider || !action || !command) {
      response.status(400).json({ error: "unitPath, provider, action, command required" });
      return;
    }
    resolveModelPath(modelRoot, unitPath);
    const created = await createSession(modelRoot, unitPath, {
      at: new Date().toISOString(),
      provider,
      action,
      command,
      status: (status as "dispatched" | "complete" | "skipped") ?? "dispatched",
      notes,
    });
    response.status(201).json({ ok: true, path: created });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/sessions", async (request, response, next) => {
  try {
    const { unitPath, filename, status, notes } = request.body as {
      unitPath?: string;
      filename?: string;
      status?: string;
      notes?: string;
    };
    if (!unitPath || !filename || !status) {
      response.status(400).json({ error: "unitPath, filename, status required" });
      return;
    }
    resolveModelPath(modelRoot, unitPath);
    const sessionStatus = status as "dispatched" | "complete" | "skipped";
    await updateSessionStatus(
      modelRoot,
      unitPath,
      filename,
      sessionStatus,
      notes,
    );
    if (sessionStatus === "complete") {
      const sessions = await listSessions(modelRoot, unitPath);
      const session = sessions.find((s) => s.filename === path.basename(filename));
      if (session) {
        await advanceUnitStatusOnSessionComplete(modelRoot, unitPath, session.action);
      }
    }
    response.json({ ok: true });
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

app.get("/api/paper/templates", async (_request, response, next) => {
  try {
    response.json({ journals: await listJournalTemplates(modelRoot) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/papers", async (request, response, next) => {
  try {
    const slug = String(request.query.slug ?? "");
    if (slug) {
      response.json({ paper: await getPaperDetail(modelRoot, slug) });
      return;
    }
    response.json({ papers: await listPapers(modelRoot) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paper", async (request, response, next) => {
  try {
    const { title, journal, authors, slug } = request.body as {
      title?: string;
      journal?: string;
      authors?: string[];
      slug?: string;
    };
    if (!title?.trim() || !journal?.trim()) {
      response.status(400).json({ error: "title and journal required" });
      return;
    }
    const created = await scaffoldPaper(modelRoot, {
      title: title.trim(),
      journal: journal.trim(),
      authors: Array.isArray(authors) ? authors : [],
      slug,
    });
    broadcastModelEvent({ type: "model-changed", path: `${created.path}/INDEX.md` });
    response.status(201).json({ ok: true, ...created });
  } catch (error) {
    next(error);
  }
});

app.post("/api/export", async (request, response, next) => {
  try {
    const { paperSlug, format, includeDrafts } = request.body as {
      paperSlug?: string;
      format?: string;
      includeDrafts?: boolean;
    };
    if (!paperSlug?.trim()) {
      response.status(400).json({ error: "paperSlug required" });
      return;
    }
    if (format !== "latex" && format !== "pdf") {
      response.status(400).json({ error: 'format must be "latex" or "pdf"' });
      return;
    }
    const result = await exportPaper(modelRoot, repoRoot, {
      paperSlug: paperSlug.trim(),
      format,
      includeDrafts,
    });
    broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/export/batch", async (request, response, next) => {
  try {
    const { paperSlug, formats, includeDrafts } = request.body as {
      paperSlug?: string;
      formats?: string[];
      includeDrafts?: boolean;
    };
    if (!paperSlug?.trim()) {
      response.status(400).json({ error: "paperSlug required" });
      return;
    }
    const validFormats = (formats ?? ["latex", "pdf"]).filter(
      (f): f is "latex" | "pdf" => f === "latex" || f === "pdf",
    );
    if (validFormats.length === 0) {
      response.status(400).json({ error: "formats must include latex and/or pdf" });
      return;
    }
    const results = await exportPaperBatch(modelRoot, repoRoot, {
      paperSlug: paperSlug.trim(),
      formats: validFormats,
      includeDrafts,
    });
    broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
    response.json({ results });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/download", async (request, response, next) => {
  try {
    const fileName = String(request.query.file ?? "");
    const abs = resolveExportDownload(repoRoot, fileName);
    response.download(abs);
  } catch (error) {
    next(error);
  }
});

app.post("/api/overleaf/push", async (request, response, next) => {
  try {
    const { paperSlug, includeDrafts } = request.body as {
      paperSlug?: string;
      includeDrafts?: boolean;
    };
    if (!paperSlug?.trim()) {
      response.status(400).json({ error: "paperSlug required" });
      return;
    }
    const result = await pushToOverleaf(
      modelRoot,
      repoRoot,
      paperSlug.trim(),
      includeDrafts === true,
    );
    broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/overleaf/import", async (request, response, next) => {
  try {
    const { paperSlug } = request.body as { paperSlug?: string };
    if (!paperSlug?.trim()) {
      response.status(400).json({ error: "paperSlug required" });
      return;
    }
    const result = await importOverleafFeedback(modelRoot, paperSlug.trim());
    if (result.paths.length) {
      for (const rel of result.paths) {
        broadcastModelEvent({ type: "model-changed", path: rel });
      }
    }
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/comments", async (request, response, next) => {
  try {
    const filePath = String(request.query.path ?? "");
    if (!filePath) {
      response.status(400).json({ error: "path required" });
      return;
    }
    resolveModelPath(modelRoot, filePath);
    response.json({ comments: await listComments(modelRoot, filePath) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/comments/summary", async (request, response, next) => {
  try {
    const paperSlug = String(request.query.paperSlug ?? "");
    if (!paperSlug) {
      response.status(400).json({ error: "paperSlug required" });
      return;
    }
    response.json(await summarizeCommentsForPaper(modelRoot, paperSlug));
  } catch (error) {
    next(error);
  }
});

app.post("/api/comments", async (request, response, next) => {
  try {
    const { path: filePath, line, author, text } = request.body as {
      path?: string;
      line?: number;
      author?: string;
      text?: string;
    };
    if (!filePath) {
      response.status(400).json({ error: "path required" });
      return;
    }
    const comment = await createComment(modelRoot, filePath, {
      line: line ?? 1,
      author: author ?? "Anonymous",
      text: text ?? "",
    });
    broadcastModelEvent({ type: "comments-changed", path: filePath });
    response.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/comments/:id", async (request, response, next) => {
  try {
    const id = String(request.params.id ?? "");
    const { path: filePath, text, resolved } = request.body as {
      path?: string;
      text?: string;
      resolved?: boolean;
    };
    if (!filePath) {
      response.status(400).json({ error: "path required" });
      return;
    }
    const comment = await updateComment(modelRoot, filePath, id, { text, resolved });
    broadcastModelEvent({ type: "comments-changed", path: filePath });
    response.json({ comment });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/comments/:id", async (request, response, next) => {
  try {
    const id = String(request.params.id ?? "");
    const filePath = String(request.query.path ?? "");
    if (!filePath) {
      response.status(400).json({ error: "path required" });
      return;
    }
    await deleteComment(modelRoot, filePath, id);
    broadcastModelEvent({ type: "comments-changed", path: filePath });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/presence", async (request, response, next) => {
  try {
    const filePath = String(request.query.path ?? "");
    if (!filePath) {
      response.status(400).json({ error: "path required" });
      return;
    }
    resolveModelPath(modelRoot, filePath);
    response.json({ presence: getPresence(filePath) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/presence/claim", async (request, response, next) => {
  try {
    const { path: filePath, user } = request.body as { path?: string; user?: string };
    if (!filePath || !user) {
      response.status(400).json({ error: "path and user required" });
      return;
    }
    resolveModelPath(modelRoot, filePath);
    const conflict = claimPresence(filePath, user);
    if (conflict) {
      response.status(409).json({ error: "Path in use", presence: conflict });
      return;
    }
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/presence/heartbeat", async (request, response, next) => {
  try {
    const { path: filePath, user } = request.body as { path?: string; user?: string };
    if (!filePath || !user) {
      response.status(400).json({ error: "path and user required" });
      return;
    }
    resolveModelPath(modelRoot, filePath);
    const ok = heartbeatPresence(filePath, user);
    response.json({ ok });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/presence/claim", async (request, response, next) => {
  try {
    const filePath = String(request.query.path ?? "");
    const user = String(request.query.user ?? "");
    if (!filePath || !user) {
      response.status(400).json({ error: "path and user required" });
      return;
    }
    releasePresence(filePath, user);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = error instanceof ModelFsError ? error.status : 500;
  response.status(status).json({
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

const modelEventClients = new Set<WebSocket>();

function broadcastModelEvent(event: Record<string, unknown>) {
  invalidateGraphCache();
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
