import express from "express";
import { describe, expect, it, vi } from "vitest";

import { registerZoteroRoutes } from "./routes/zotero.js";
import type { ServerDeps } from "./routes/types.js";

function createDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    modelRoot: "/tmp/model",
    repoRoot: "/tmp/repo",
    broadcastModelEvent: () => {},
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
    getZoteroLocalConfig: async () => ({
      enabled: false,
      baseUrl: "http://127.0.0.1:23119/api",
    }),
    getAutoExportState: () => ({
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastPaperSlug: null,
      lastMessage: null,
    }),
    runAutoExportNow: async () => {},
    ...overrides,
  };
}

describe("zotero routes", () => {
  it("returns 403 for search when disabled", async () => {
    const app = express();
    app.use(express.json());
    registerZoteroRoutes(app, createDeps());
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/zotero/local/search?q=test`);
      expect(response.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns hits when enabled and Zotero responds", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("23119")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                key: "XYZ",
                data: { title: "Hello", creators: [], date: "2021", itemType: "journalArticle" },
              },
            ]),
            { status: 200 },
          ),
        );
      }
      return originalFetch(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = express();
    app.use(express.json());
    registerZoteroRoutes(
      app,
      createDeps({
        getZoteroLocalConfig: async () => ({
          enabled: true,
          baseUrl: "http://127.0.0.1:23119/api",
        }),
      }),
    );
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/zotero/local/search?q=hello`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { hits: { itemKey: string }[] };
      expect(body.hits[0]?.itemKey).toBe("XYZ");
    } finally {
      vi.unstubAllGlobals();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
