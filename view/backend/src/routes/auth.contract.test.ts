import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createTestServer } from "../test/createTestApp.js";

let repoRoot: string;
let modelRoot: string;
const draftRel = "papers/demo/intro/draft.md";
const prevRestAuth = process.env.TREEWRITER_REST_AUTH;
const prevWsToken = process.env.TREEWRITER_WS_TOKEN;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-auth-contract-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(path.join(modelRoot, path.dirname(draftRel)), { recursive: true });
  await writeFile(path.join(modelRoot, draftRel), "# Intro\n\nBody\n", "utf8");
});

afterEach(async () => {
  process.env.TREEWRITER_REST_AUTH = prevRestAuth;
  process.env.TREEWRITER_WS_TOKEN = prevWsToken;
  await rm(repoRoot, { recursive: true, force: true });
});

describe("REST auth middleware", () => {
  it("returns 401 for protected routes when TREEWRITER_REST_AUTH is enabled without token", async () => {
    process.env.TREEWRITER_REST_AUTH = "true";
    process.env.TREEWRITER_WS_TOKEN = "test-secret";
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/api/model/tree");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    } finally {
      await server.close();
    }
  });

  it("allows protected routes with matching X-TreeWriter-Token header", async () => {
    process.env.TREEWRITER_REST_AUTH = "true";
    process.env.TREEWRITER_WS_TOKEN = "test-secret";
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app)
        .get("/api/model/tree")
        .set("X-TreeWriter-Token", "test-secret");
      expect(res.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("keeps /health open when REST auth is enabled", async () => {
    process.env.TREEWRITER_REST_AUTH = "true";
    process.env.TREEWRITER_WS_TOKEN = "test-secret";
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      await server.close();
    }
  });
});
