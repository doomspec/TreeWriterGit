import path from "node:path";
import { stat } from "node:fs/promises";
import type { Express } from "express";

import {
  buildFanOutPreviews,
  buildPreview,
  gatherContextFromPaths,
  loadProviders,
  listContextCandidates,
  runDispatch,
  runFanOutDispatch,
  type DispatchAction,
} from "../agentDispatch.js";
import {
  isDraftFilePath,
  isOutlineFilePath,
  markDraftAiAssisted,
  markOutlineAiAssisted,
  normalizeGitHubHandle,
  unitDirFromDraftFile,
  unitDirFromOutlineFile,
} from "../draftApproval.js";
import { resolveModelPath } from "../modelFs.js";
import {
  advanceUnitStatusOnSessionComplete,
  createSession,
  listSessions,
  updateSessionStatus,
} from "../sessions.js";
import {
  addChatSessionContextFiles,
  appendChatTurn,
  createChatSession,
  listChatSessions,
  readChatSession,
  type ChatMode,
  type ChatRole,
} from "../chatSessions.js";
import { isBridgedProvider, runBridgedTurn } from "../aiChat/bridgedAdapters.js";
import {
  deleteDispatchSkill,
  DispatchSkillError,
  listDispatchSkills,
  readDispatchSkillContent,
  renameDispatchSkill,
  resetSystemSkill,
  saveDispatchSkill,
  saveDispatchSkillsEnabled,
  updateDispatchSkillContent,
} from "../dispatchSkills.js";
import type { ServerDeps } from "./types.js";
import { asyncHandler } from "./asyncHandler.js";

/** mtime+size fingerprint, used to detect whether a bridged chat turn edited a file directly. */
async function fileFingerprint(absPath: string): Promise<string | null> {
  try {
    const info = await stat(absPath);
    return `${info.mtimeMs}:${info.size}`;
  } catch {
    return null;
  }
}

export function registerAgentRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/agent/providers", async (_request, response, next) => {
    try {
      response.json(await loadProviders(deps.repoRoot));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/agent/skills", async (_request, response, next) => {
    try {
      response.json({ skills: await listDispatchSkills(deps.repoRoot) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agent/skills", async (request, response, next) => {
    try {
      const { filename, content } = request.body as { filename?: string; content?: string };
      if (!filename?.trim() || typeof content !== "string") {
        response.status(400).json({ error: "filename and content required" });
        return;
      }
      const skill = await saveDispatchSkill(deps.repoRoot, filename, content);
      response.status(201).json({ skill });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/agent/skills/enabled", async (request, response, next) => {
    try {
      const { enabled } = request.body as { enabled?: string[] };
      if (!Array.isArray(enabled)) {
        response.status(400).json({ error: "enabled array required" });
        return;
      }
      const normalized = await saveDispatchSkillsEnabled(deps.repoRoot, enabled);
      response.json({ enabled: normalized, skills: await listDispatchSkills(deps.repoRoot) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/agent/skills/:filename", async (request, response, next) => {
    try {
      const filename = String(request.params.filename ?? "");
      if (!filename) {
        response.status(400).json({ error: "filename required" });
        return;
      }
      await deleteDispatchSkill(deps.repoRoot, filename);
      response.json({ ok: true, skills: await listDispatchSkills(deps.repoRoot) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/agent/skills/:filename", async (request, response, next) => {
    try {
      const filename = String(request.params.filename ?? "");
      if (!filename) {
        response.status(400).json({ error: "filename required" });
        return;
      }
      response.json({ content: await readDispatchSkillContent(deps.repoRoot, filename) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/agent/skills/:filename", async (request, response, next) => {
    try {
      const filename = String(request.params.filename ?? "");
      const { content, newFilename } = request.body as { content?: string; newFilename?: string };
      if (!filename) {
        response.status(400).json({ error: "filename required" });
        return;
      }
      let current = filename;
      if (typeof newFilename === "string" && newFilename.trim() && newFilename.trim() !== filename) {
        const renamed = await renameDispatchSkill(deps.repoRoot, filename, newFilename);
        current = renamed.skillPath;
      }
      if (typeof content === "string") {
        await updateDispatchSkillContent(deps.repoRoot, current, content);
      }
      response.json({ ok: true, skills: await listDispatchSkills(deps.repoRoot) });
    } catch (error) {
      if (error instanceof DispatchSkillError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  app.post("/api/agent/skills/system/:filename/reset", async (request, response, next) => {
    try {
      const filename = String(request.params.filename ?? "");
      if (!filename) {
        response.status(400).json({ error: "filename required" });
        return;
      }
      const skill = await resetSystemSkill(deps.repoRoot, filename);
      response.json({ ok: true, skill, skills: await listDispatchSkills(deps.repoRoot) });
    } catch (error) {
      if (error instanceof DispatchSkillError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
      }
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
      resolveModelPath(deps.modelRoot, unitPath);
      response.json({ files: await listContextCandidates(deps.modelRoot, unitPath, action) });
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
      resolveModelPath(deps.modelRoot, unitPath);
      const config = await loadProviders(deps.repoRoot);
      const provider =
        config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
      const result = await buildPreview(
        deps.modelRoot,
        deps.repoRoot,
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
      resolveModelPath(deps.modelRoot, sectionPath);
      const config = await loadProviders(deps.repoRoot);
      const provider =
        config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
      const units = await buildFanOutPreviews(
        deps.modelRoot,
        deps.repoRoot,
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

  app.post("/api/agent/fan-out/run", async (request, response, next) => {
    try {
      const { sectionPath, action, provider: providerName, customPrompt, triggeredBy } = request.body as {
        sectionPath?: string;
        action?: string;
        provider?: string;
        customPrompt?: string;
        triggeredBy?: string;
      };
      if (!sectionPath) {
        response.status(400).json({ error: "sectionPath required" });
        return;
      }
      resolveModelPath(deps.modelRoot, sectionPath);
      const config = await loadProviders(deps.repoRoot);
      const provider =
        config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
      const dispatchAction = (action ?? "draft") as DispatchAction;
      const results = await runFanOutDispatch(
        deps.modelRoot,
        deps.repoRoot,
        sectionPath,
        dispatchAction,
        provider,
        customPrompt,
      );
      for (const result of results) {
        const unitRel = result.outputPath.replace(/\/(?:draft|outline)\.md$/, "");
        await createSession(deps.modelRoot, unitRel, {
          at: new Date().toISOString(),
          provider: result.providerName,
          action: dispatchAction,
          command: result.command,
          status: "complete",
        });
        if (isDraftFilePath(result.outputPath)) {
          for (const sidePath of await markDraftAiAssisted(
            deps.modelRoot,
            unitRel,
            normalizeGitHubHandle(triggeredBy),
            result.providerName,
          )) {
            deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
          }
        } else if (isOutlineFilePath(result.outputPath)) {
          for (const sidePath of await markOutlineAiAssisted(
            deps.modelRoot,
            unitRel,
            normalizeGitHubHandle(triggeredBy),
            result.providerName,
          )) {
            deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
          }
        }
        deps.broadcastModelEvent({ type: "model-changed", path: result.outputPath });
      }
      response.json({
        ok: true,
        count: results.length,
        units: results.map((r) => ({ outputPath: r.outputPath, sessionId: r.sessionId })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agent/run", async (request, response, next) => {
    try {
      const { unitPath, action, provider: providerName, customPrompt, contextPaths, triggeredBy } =
        request.body as {
          unitPath?: string;
          action?: string;
          provider?: string;
          customPrompt?: string;
          contextPaths?: string[];
          triggeredBy?: string;
        };
      if (!unitPath) {
        response.status(400).json({ error: "unitPath required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      const config = await loadProviders(deps.repoRoot);
      const provider =
        config.aiProviders.find((p) => p.name === providerName) ?? config.aiProviders[0];
      const dispatchAction = (action ?? "draft") as DispatchAction;
      const result = await runDispatch(
        deps.modelRoot,
        deps.repoRoot,
        unitPath,
        dispatchAction,
        provider,
        customPrompt,
        contextPaths,
      );
      await createSession(deps.modelRoot, unitPath, {
        at: new Date().toISOString(),
        provider: result.providerName,
        action: dispatchAction,
        command: result.command,
        status: "complete",
      });
      if (isDraftFilePath(result.outputPath)) {
        const unitRel = unitDirFromDraftFile(result.outputPath);
        for (const sidePath of await markDraftAiAssisted(
          deps.modelRoot,
          unitRel,
          normalizeGitHubHandle(triggeredBy),
          result.providerName,
        )) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      } else if (isOutlineFilePath(result.outputPath)) {
        const unitRel = unitDirFromOutlineFile(result.outputPath);
        for (const sidePath of await markOutlineAiAssisted(
          deps.modelRoot,
          unitRel,
          normalizeGitHubHandle(triggeredBy),
          result.providerName,
        )) {
          deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
        }
      }
      deps.broadcastModelEvent({ type: "model-changed", path: result.outputPath });
      response.json({
        ok: true,
        outputPath: result.outputPath,
        sessionId: result.sessionId,
        provider: result.providerName,
        action: dispatchAction,
      });
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
      resolveModelPath(deps.modelRoot, unitPath);
      response.json({ sessions: await listSessions(deps.modelRoot, unitPath) });
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
      resolveModelPath(deps.modelRoot, unitPath);
      const created = await createSession(deps.modelRoot, unitPath, {
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
      resolveModelPath(deps.modelRoot, unitPath);
      const sessionStatus = status as "dispatched" | "complete" | "skipped";
      await updateSessionStatus(
        deps.modelRoot,
        unitPath,
        filename,
        sessionStatus,
        notes,
      );
      if (sessionStatus === "complete") {
        const sessions = await listSessions(deps.modelRoot, unitPath);
        const session = sessions.find((s) => s.filename === path.basename(filename));
        if (session) {
          await advanceUnitStatusOnSessionComplete(deps.modelRoot, unitPath, session.action);
        }
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/chat", async (request, response, next) => {
    try {
      const unitPath = String(request.query.unitPath ?? "");
      if (!unitPath) {
        response.status(400).json({ error: "unitPath required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      response.json({ sessions: await listChatSessions(deps.modelRoot, unitPath) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/chat/read", async (request, response, next) => {
    try {
      const unitPath = String(request.query.unitPath ?? "");
      const filename = String(request.query.filename ?? "");
      if (!unitPath || !filename) {
        response.status(400).json({ error: "unitPath, filename required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      response.json(await readChatSession(deps.modelRoot, unitPath, filename));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/chat", async (request, response, next) => {
    try {
      const { unitPath, provider, mode, terminalSessionId, agentSessionId, contextFiles } =
        request.body as {
          unitPath?: string;
          provider?: string;
          mode?: string;
          terminalSessionId?: string;
          agentSessionId?: string;
          contextFiles?: string[];
        };
      if (!unitPath || !provider || (mode !== "pty" && mode !== "bridged")) {
        response.status(400).json({ error: "unitPath, provider, mode (pty|bridged) required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      const created = await createChatSession(deps.modelRoot, unitPath, {
        provider,
        mode: mode as ChatMode,
        terminalSessionId,
        agentSessionId,
        contextFiles: contextFiles?.length ? contextFiles : undefined,
      });
      response.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/chat/context", async (request, response, next) => {
    try {
      const { unitPath, filename, contextFiles } = request.body as {
        unitPath?: string;
        filename?: string;
        contextFiles?: string[];
      };
      if (!unitPath || !filename || !Array.isArray(contextFiles)) {
        response.status(400).json({ error: "unitPath, filename, contextFiles[] required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      const merged = await addChatSessionContextFiles(deps.modelRoot, unitPath, filename, contextFiles);
      response.json({ ok: true, contextFiles: merged });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/chat/append", async (request, response, next) => {
    try {
      const { unitPath, filename, turn } = request.body as {
        unitPath?: string;
        filename?: string;
        turn?: { role?: string; text?: string; at?: string };
      };
      if (
        !unitPath ||
        !filename ||
        !turn ||
        (turn.role !== "user" && turn.role !== "assistant") ||
        typeof turn.text !== "string"
      ) {
        response.status(400).json({ error: "unitPath, filename, turn{role,text} required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      await appendChatTurn(deps.modelRoot, unitPath, filename, {
        role: turn.role as ChatRole,
        text: turn.text,
        at: turn.at ?? new Date().toISOString(),
      });
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agent/chat-turn", async (request, response, next) => {
    try {
      const { provider, prompt, sessionId, contextPaths, unitPath, triggeredBy } = request.body as {
        provider?: string;
        prompt?: string;
        sessionId?: string | null;
        contextPaths?: string[];
        unitPath?: string;
        triggeredBy?: string;
      };
      if (!provider || !prompt) {
        response.status(400).json({ error: "provider, prompt required" });
        return;
      }
      if (!isBridgedProvider(provider)) {
        response.status(400).json({ error: `Unsupported bridged provider: ${provider}` });
        return;
      }
      let fullPrompt = prompt;
      if (contextPaths?.length) {
        const contextBlock = await gatherContextFromPaths(deps.modelRoot, contextPaths);
        if (contextBlock) fullPrompt = `${contextBlock}\n\n${prompt}`;
      }
      // Tell the CLI which unit it's scoped to on the first turn of a session —
      // otherwise it has to search the whole repo for the right draft.md/outline.md
      // (observed: a fresh codex turn grepping the tree before doing anything).
      // Once a session id exists (resumed turns), the CLI already has this from
      // its own history, so skip repeating it.
      if (unitPath && !sessionId) {
        fullPrompt = `Context: you are working in the TreeWriter unit "${unitPath}" (paths below are relative to the model/ root).\n\n${fullPrompt}`;
      }

      // The bridged CLI runs against the whole repo — snapshot this unit's
      // manuscript files so an edit it makes directly (outside any dispatch
      // action) still surfaces in the review rail, same as a dispatch run.
      let draftPath: string | null = null;
      let outlinePath: string | null = null;
      let draftBefore: string | null = null;
      let outlineBefore: string | null = null;
      if (unitPath) {
        resolveModelPath(deps.modelRoot, unitPath);
        draftPath = `${unitPath}/draft.md`;
        outlinePath = `${unitPath}/outline.md`;
        draftBefore = await fileFingerprint(path.join(deps.modelRoot, draftPath));
        outlineBefore = await fileFingerprint(path.join(deps.modelRoot, outlinePath));
      }

      const result = await runBridgedTurn(provider, deps.modelRoot, fullPrompt, sessionId ?? null);

      if (unitPath && draftPath && outlinePath) {
        const editedBy = normalizeGitHubHandle(triggeredBy);
        const draftAfter = await fileFingerprint(path.join(deps.modelRoot, draftPath));
        if (draftAfter !== null && draftAfter !== draftBefore) {
          for (const sidePath of await markDraftAiAssisted(deps.modelRoot, unitPath, editedBy, provider)) {
            deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
          }
          deps.broadcastModelEvent({ type: "model-changed", path: draftPath });
        }
        const outlineAfter = await fileFingerprint(path.join(deps.modelRoot, outlinePath));
        if (outlineAfter !== null && outlineAfter !== outlineBefore) {
          for (const sidePath of await markOutlineAiAssisted(deps.modelRoot, unitPath, editedBy, provider)) {
            deps.broadcastModelEvent({ type: "model-changed", path: sidePath });
          }
          deps.broadcastModelEvent({ type: "model-changed", path: outlinePath });
        }
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/agent/jobs",
    asyncHandler(async (request, response) => {
      const unitPath = String(request.query.unitPath ?? "").trim();
      if (!unitPath) {
        response.status(400).json({ error: "unitPath required" });
        return;
      }
      resolveModelPath(deps.modelRoot, unitPath);
      const jobs = deps.agentJobs?.listForUnit(unitPath) ?? [];
      response.json({ jobs });
    }),
  );
}
