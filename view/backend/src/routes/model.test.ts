import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import express from "express";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readModelTree } from "../modelTree.js";
import { registerModelRoutes } from "./model.js";
import type { ServerDeps } from "./types.js";

let modelRoot: string;
let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-routes-repo-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
  await writeFile(path.join(modelRoot, "outline.md"), "# Root\n", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function createTestDeps(): ServerDeps {
  return {
    modelRoot,
    repoRoot,
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
    reloadGitSyncSchedule: () => {},
  };
}

async function withTestServer(run: (port: number) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  registerModelRoutes(app, createTestDeps());
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

async function seedPaperSection(): Promise<string> {
  const sectionRel = "papers/demo/intro";
  await mkdir(path.join(modelRoot, sectionRel, "background"), { recursive: true });
  await writeFile(
    path.join(modelRoot, sectionRel, "INDEX.md"),
    matter.stringify("", { kind: "section", title: "Introduction", child_order: ["background"] }),
    "utf8",
  );
  await writeFile(path.join(modelRoot, sectionRel, "outline.md"), "# Introduction\n\n## Summary\n\n- Point\n", "utf8");
  await writeFile(
    path.join(modelRoot, sectionRel, "background", "INDEX.md"),
    matter.stringify("", { kind: "unit", title: "Background", status: "drafted" }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, sectionRel, "background", "outline.md"),
    "# Background\n\nOverview:\n- Claim one\n",
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, sectionRel, "background", "draft.md"),
    "Background paragraph text.\n",
    "utf8",
  );
  return sectionRel;
}

describe("registerModelRoutes", () => {
  it("registers /api/model/tree and returns the model tree", async () => {
    await withTestServer(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/model/tree`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        root: string;
        tree: unknown[];
        treeVersion: number;
      };
      expect(body.root).toBe("model");
      expect(body.tree.length).toBeGreaterThan(0);
      expect(typeof body.treeVersion).toBe("number");
    });
  });

  it("GET /api/model/tree supports scoped path and depth", async () => {
    await seedPaperSection();
    await withTestServer(async (port) => {
      const scoped = await fetch(
        `http://127.0.0.1:${port}/api/model/tree?path=${encodeURIComponent("papers/demo/intro")}`,
      );
      expect(scoped.status).toBe(200);
      const scopedBody = (await scoped.json()) as {
        root: string;
        tree: { name: string; path: string; children?: unknown[] }[];
      };
      expect(scopedBody.root).toBe("papers/demo/intro");
      expect(scopedBody.tree.some((node) => node.name === "background")).toBe(true);

      const shallow = await fetch(`http://127.0.0.1:${port}/api/model/tree?depth=0`);
      expect(shallow.status).toBe(200);
      const shallowBody = (await shallow.json()) as {
        tree: { name: string; hasChildren?: boolean; children?: unknown[] }[];
      };
      const papers = shallowBody.tree.find((node) => node.name === "papers");
      expect(papers?.hasChildren).toBe(true);
      expect(papers?.children).toBeUndefined();

      const invalid = await fetch(`http://127.0.0.1:${port}/api/model/tree?depth=-1`);
      expect(invalid.status).toBe(400);
    });
  });

  it("GET /api/model/section-compose stitches child drafts", async () => {
    const sectionRel = await seedPaperSection();
    await withTestServer(async (port) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/model/section-compose?path=${encodeURIComponent(sectionRel)}`,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { draftMarkdown?: string; outlineMarkdown?: string };
      expect(body.draftMarkdown).toContain("Background paragraph");
      expect(body.outlineMarkdown).toContain("Introduction");
    });
  });

  it("GET /api/model/file materializes temp-notes without approval sidecars", async () => {
    const sectionRel = "papers/demo/intro";
    await mkdir(path.join(modelRoot, sectionRel), { recursive: true });
    await writeFile(
      path.join(modelRoot, sectionRel, "INDEX.md"),
      matter.stringify("", { kind: "section", title: "Introduction", child_order: [] }),
      "utf8",
    );
    await withTestServer(async (port) => {
      const notesRel = `${sectionRel}/temp-notes.md`;
      const getResponse = await fetch(
        `http://127.0.0.1:${port}/api/model/file?path=${encodeURIComponent(notesRel)}`,
      );
      expect(getResponse.status).toBe(200);
      const getBody = (await getResponse.json()) as { content: string };
      expect(getBody.content).toBe("");

      const putResponse = await fetch(`http://127.0.0.1:${port}/api/model/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: notesRel, content: "Updated scratchpad\n" }),
      });
      expect(putResponse.status).toBe(200);
      expect(existsSync(path.join(modelRoot, notesRel))).toBe(true);
      expect(existsSync(path.join(modelRoot, sectionRel, ".approval", "draft.approved.md"))).toBe(false);
      expect(existsSync(path.join(modelRoot, sectionRel, ".approval", "outline.approved.md"))).toBe(false);
    });
  });

  it("POST /api/model/draft-approve writes approved baseline", async () => {
    const sectionRel = await seedPaperSection();
    const draftRel = `${sectionRel}/background/draft.md`;
    await withTestServer(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/model/draft-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: draftRel, approvedBy: "testuser" }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { updated: string[] };
      expect(body.updated.some((rel) => rel.endsWith("draft.approved.md"))).toBe(true);

      const approved = await fetch(
        `http://127.0.0.1:${port}/api/model/draft-approved?path=${encodeURIComponent(draftRel)}`,
      );
      expect(approved.status).toBe(200);
      const approvedBody = (await approved.json()) as { content: string; meta: { approvedBy: string | null } };
      expect(approvedBody.content).toContain("Background paragraph");
      expect(approvedBody.meta.approvedBy).toBe("testuser");
    });
  });

  it("readModelTree reads files from modelRoot", async () => {
    const tree = await readModelTree(modelRoot);
    expect(tree.some((node) => node.name === "outline.md")).toBe(true);
  });

  it("readModelTree includes folder kind from INDEX.md", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/intro"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/intro/INDEX.md"),
      "---\nkind: unit\ntitle: Intro\n---\n",
      "utf8",
    );
    const tree = await readModelTree(modelRoot);
    const intro = tree
      .find((node) => node.name === "papers")
      ?.children?.find((node) => node.name === "demo")
      ?.children?.find((node) => node.name === "intro");
    expect(intro?.kind).toBe("unit");
  });
});
