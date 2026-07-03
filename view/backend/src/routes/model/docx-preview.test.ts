import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../import/index.js", () => ({
  convertDocxBufferToMarkdown: vi.fn(async (buffer: Buffer) => `# Converted\n\n${buffer.toString("utf8")}`),
}));

import { createTestServer } from "../../test/createTestApp.js";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-docx-preview-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(path.join(modelRoot, "explorer"), { recursive: true });
  await writeFile(path.join(modelRoot, "explorer", "report.docx"), "fake docx bytes", "utf8");
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("GET /api/model/docx-preview", () => {
  it("converts the docx buffer to markdown via convertDocxBufferToMarkdown", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app)
        .get("/api/model/docx-preview")
        .query({ path: "explorer/report.docx" });
      expect(res.status).toBe(200);
      expect(res.body.markdown).toContain("# Converted");
      expect(res.body.markdown).toContain("fake docx bytes");
    } finally {
      await server.close();
    }
  });

  it("404s when the path does not exist", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app)
        .get("/api/model/docx-preview")
        .query({ path: "explorer/missing.docx" });
      expect(res.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("400s when path query parameter is missing", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app).get("/api/model/docx-preview");
      expect(res.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("400s when path points at a directory", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app)
        .get("/api/model/docx-preview")
        .query({ path: "explorer" });
      expect(res.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});
