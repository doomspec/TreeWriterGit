import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNode } from "../model/crud.js";
import { readDraftEditMeta, readOutlineEditMeta } from "../draftApproval.js";
import type { ServerDeps } from "./types.js";

vi.mock("../aiChat/bridgedAdapters.js", () => ({
  isBridgedProvider: (provider: string) =>
    ["claude", "codex", "gemini", "hermes"].includes(provider),
  runBridgedTurn: vi.fn(),
}));

const { runBridgedTurn } = await import("../aiChat/bridgedAdapters.js");
const { registerAgentRoutes } = await import("./agent.js");

let modelRoot: string;
let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-chat-turn-repo-"));
  modelRoot = path.join(repoRoot, "model");
  await createNode(modelRoot, "papers", "demo", "section");
  await createNode(modelRoot, "papers/demo", "unit-a", "unit");
  vi.mocked(runBridgedTurn).mockReset();
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function createTestDeps(broadcastModelEvent = vi.fn()): ServerDeps {
  return {
    modelRoot,
    repoRoot,
    broadcastModelEvent,
    getGitSyncState: () => ({
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastOutput: null,
      conflictDetected: false,
      pendingStashRestore: false,
      viewChangesBlocked: false,
    }),
    runGitSync: async () => ({
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastOutput: null,
      conflictDetected: false,
      pendingStashRestore: false,
      viewChangesBlocked: false,
    }),
    getGitSyncConfig: async () => ({
      enabled: false,
      autoSync: false,
      intervalMs: 120_000,
      commitPaths: ["model"],
      excludePaths: ["view"],
    }),
    getExportConfig: async () => ({
      autoExport: false,
      includeDrafts: true,
      pushOverleaf: true,
      debounceMs: 60_000,
      blockOnOrphanRefs: false,
      blockOnUnapproved: false,
      blockOnMissingCitations: false,
    }),
    getZoteroLocalConfig: async () => ({ enabled: false, baseUrl: "http://127.0.0.1:23119/api" }),
    getAutoExportState: () => ({
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastPaperSlug: null,
      lastMessage: null,
    }),
    runAutoExportNow: async () => {},
    reloadGitSyncSchedule: () => {},
  };
}

async function withTestServer(
  deps: ServerDeps,
  run: (port: number) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  registerAgentRoutes(app, deps);
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    await run(port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("POST /api/agent/chat-turn — review-rail linking (Stage 7)", () => {
  it("marks the draft ai-assisted and broadcasts a model-changed event when the CLI edits it directly", async () => {
    vi.mocked(runBridgedTurn).mockImplementation(async () => {
      // Simulate the bridged CLI editing the unit's draft file mid-turn.
      await writeFile(path.join(modelRoot, "papers/demo/unit-a/draft.md"), "New text.\n", "utf8");
      return { text: "Done — updated the draft.", sessionId: null };
    });
    const broadcastModelEvent = vi.fn();

    await withTestServer(createTestDeps(broadcastModelEvent), async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "codex",
          prompt: "Fix the typo.",
          unitPath: "papers/demo/unit-a",
          triggeredBy: "octocat",
        }),
      });
      expect(response.status).toBe(200);
    });

    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(true);
    expect(meta.editedBy).toBe("octocat");
    expect(broadcastModelEvent).toHaveBeenCalledWith({
      type: "model-changed",
      path: "papers/demo/unit-a/draft.md",
    });
  });

  it("marks the outline ai-assisted when the CLI edits outline.md instead", async () => {
    vi.mocked(runBridgedTurn).mockImplementation(async () => {
      await writeFile(
        path.join(modelRoot, "papers/demo/unit-a/outline.md"),
        "# New outline\n",
        "utf8",
      );
      return { text: "Updated the outline.", sessionId: null };
    });

    await withTestServer(createTestDeps(), async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "gemini",
          prompt: "Restructure the outline.",
          unitPath: "papers/demo/unit-a",
        }),
      });
      expect(response.status).toBe(200);
    });

    const meta = await readOutlineEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBe(true);
  });

  it("does not mark ai-assisted when neither file changed", async () => {
    vi.mocked(runBridgedTurn).mockResolvedValue({ text: "Just chatting.", sessionId: null });

    await withTestServer(createTestDeps(), async (port) => {
      await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "claude",
          prompt: "What does this section argue?",
          unitPath: "papers/demo/unit-a",
        }),
      });
    });

    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.aiAssisted).toBeFalsy();
  });

  it("skips the file-change check entirely when unitPath is omitted", async () => {
    vi.mocked(runBridgedTurn).mockImplementation(async () => {
      await writeFile(path.join(modelRoot, "papers/demo/unit-a/draft.md"), "Sneaky edit.\n", "utf8");
      return { text: "ok", sessionId: null };
    });
    const broadcastModelEvent = vi.fn();

    await withTestServer(createTestDeps(broadcastModelEvent), async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "claude", prompt: "hi" }),
      });
      expect(response.status).toBe(200);
    });

    expect(broadcastModelEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/chat-turn — first-turn unit context line", () => {
  it("prepends a context line naming the unit on the first turn of a session", async () => {
    let receivedPrompt = "";
    vi.mocked(runBridgedTurn).mockImplementation(async (_provider, _cwd, prompt) => {
      receivedPrompt = prompt;
      return { text: "ok", sessionId: "sess-1" };
    });

    await withTestServer(createTestDeps(), async (port) => {
      await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "claude",
          prompt: "What does this section argue?",
          unitPath: "papers/demo/unit-a",
        }),
      });
    });

    expect(receivedPrompt).toBe(
      'Context: you are working in the TreeWriter unit "papers/demo/unit-a" ' +
        "(paths below are relative to the model/ root).\n\nWhat does this section argue?",
    );
  });

  it("does not repeat the context line on a resumed turn (sessionId present)", async () => {
    let receivedPrompt = "";
    vi.mocked(runBridgedTurn).mockImplementation(async (_provider, _cwd, prompt) => {
      receivedPrompt = prompt;
      return { text: "ok", sessionId: "sess-1" };
    });

    await withTestServer(createTestDeps(), async (port) => {
      await fetch(`http://127.0.0.1:${port}/api/agent/chat-turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "claude",
          prompt: "And what about the next paragraph?",
          unitPath: "papers/demo/unit-a",
          sessionId: "sess-1",
        }),
      });
    });

    expect(receivedPrompt).toBe("And what about the next paragraph?");
  });
});
