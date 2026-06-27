import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, createTestServer } from "./createTestApp.js";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-test-app-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
  await writeFile(path.join(modelRoot, "outline.md"), "# Root\n", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("createTestApp", () => {
  it("exposes health and dev reset routes", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const health = await fetch(`http://127.0.0.1:${server.port}/health`);
      expect(health.status).toBe(200);

      const reset = await fetch(`http://127.0.0.1:${server.port}/api/dev/reset`, { method: "POST" });
      expect(reset.status).toBe(200);
      const body = (await reset.json()) as { graphCacheCleared: boolean };
      expect(body.graphCacheCleared).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("returns model tree", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/api/model/tree`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { tree: unknown[] };
      expect(body.tree.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });
});
