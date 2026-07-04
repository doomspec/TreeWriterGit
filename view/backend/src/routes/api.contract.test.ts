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

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-api-contract-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(path.join(modelRoot, path.dirname(draftRel)), { recursive: true });
  await writeFile(path.join(modelRoot, draftRel), "# Intro\n\nBody\n", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("settings API contract", () => {
  it("GET /health returns ok and modelRoot", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          ok: true,
          modelRoot: expect.any(String),
          gitSync: expect.any(Object),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it("GET /api/git-sync/status includes autoSync and intervalMs", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/api/git-sync/status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          enabled: expect.any(Boolean),
          autoSync: expect.any(Boolean),
          intervalMs: expect.any(Number),
        }),
      );
    } finally {
      await server.close();
    }
  });
});

describe("papers API contract", () => {
  it("POST /api/paper then GET /api/papers?slug=", async () => {
    await mkdir(path.join(modelRoot, "templates"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "templates/plos-one.md"),
      "---\njournal: PLOS ONE\nsection_order:\n  - introduction\nexport:\n  documentclass: article\n---\n",
      "utf8",
    );

    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);
      const createRes = await agent.post("/api/paper").send({
        title: "Contract Test Paper",
        journal: "PLOS ONE",
        authors: ["Ada Lovelace"],
      });
      expect(createRes.status).toBe(201);
      expect(createRes.body).toEqual(
        expect.objectContaining({
          slug: expect.any(String),
          path: expect.stringMatching(/^papers\//),
        }),
      );
      const slug = createRes.body.slug as string;

      const listRes = await agent.get("/api/papers");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.papers)).toBe(true);

      const detailRes = await agent.get(`/api/papers?slug=${encodeURIComponent(slug)}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.paper).toEqual(
        expect.objectContaining({
          slug,
          title: "Contract Test Paper",
          authors: ["Ada Lovelace"],
          docType: "paper",
          tags: [],
        }),
      );
    } finally {
      await server.close();
    }
  });

  it("POST /api/manuscript creates grant and GET filters by docType", async () => {
    await mkdir(path.join(modelRoot, "templates"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "templates/nsf-research-proposal.md"),
      `---
doc_type: grant
template_id: nsf-research-proposal
section_order:
  - specific-aims
notes_dirs:
  - literature
  - budget
asset_dirs: []
---
`,
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "templates/plos-one.md"),
      "---\njournal: PLOS ONE\nsection_order:\n  - introduction\n---\n",
      "utf8",
    );

    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);
      const createRes = await agent.post("/api/manuscript").send({
        title: "Contract Grant",
        docType: "grant",
        templateId: "nsf-research-proposal",
        authors: ["PI"],
        funder: "NSF",
        tags: ["nsf"],
      });
      expect(createRes.status).toBe(201);

      const templatesRes = await agent.get("/api/manuscript/templates?docType=grant");
      expect(templatesRes.status).toBe(200);
      expect(templatesRes.body.templates.length).toBeGreaterThan(0);

      const listRes = await agent.get("/api/manuscripts?docType=grant");
      expect(listRes.status).toBe(200);
      expect(listRes.body.manuscripts).toHaveLength(1);
      expect(listRes.body.manuscripts[0].docType).toBe("grant");
    } finally {
      await server.close();
    }
  });
});

describe("presence API contract", () => {
  it("claim, heartbeat, get, and release presence", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);

      const claimRes = await agent.post("/api/presence/claim").send({
        path: draftRel,
        user: "Alice",
      });
      expect(claimRes.status).toBe(200);
      expect(claimRes.body).toEqual({ ok: true });

      const getRes = await agent.get(`/api/presence?path=${encodeURIComponent(draftRel)}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.presence).toEqual(
        expect.objectContaining({ user: "Alice", since: expect.any(String) }),
      );

      const heartbeatRes = await agent.post("/api/presence/heartbeat").send({
        path: draftRel,
        user: "Alice",
      });
      expect(heartbeatRes.status).toBe(200);

      const releaseRes = await agent
        .delete("/api/presence/claim")
        .query({ path: draftRel, user: "Alice" });
      expect(releaseRes.status).toBe(200);
    } finally {
      await server.close();
    }
  });
});

describe("agent API contract", () => {
  it("GET /api/agent/providers returns provider list shape", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/api/agent/providers");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          aiProviders: expect.any(Array),
          defaultProvider: expect.any(String),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it("GET /api/contributors returns the global registry", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const empty = await request(server.app).get("/api/contributors");
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({
        registry: { affiliations: [], authors: [] },
      });

      const { writeContributorsRegistry } = await import("../contributorsRegistry.js");
      await writeContributorsRegistry(modelRoot, {
        affiliations: ["MIT"],
        authors: [{ firstName: "Grace", lastName: "Hopper", affiliationTexts: ["MIT"] }],
      });
      const seeded = await request(server.app).get("/api/contributors");
      expect(seeded.body.registry.affiliations).toEqual(["MIT"]);
      expect(seeded.body.registry.authors[0].lastName).toBe("Hopper");
    } finally {
      await server.close();
    }
  });

  it("GET /api/agent/context requires unitPath", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const missing = await request(server.app).get("/api/agent/context");
      expect(missing.status).toBe(400);

      const res = await request(server.app).get(
        `/api/agent/context?unitPath=${encodeURIComponent("papers/demo/intro")}&action=draft`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          files: expect.any(Array),
        }),
      );
    } finally {
      await server.close();
    }
  });
});
