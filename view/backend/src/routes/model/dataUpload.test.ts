import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createTestServer } from "../../test/createTestApp.js";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-data-upload-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(path.join(modelRoot, "papers/demo/notes/data"), { recursive: true });
  await writeFile(
    path.join(modelRoot, "papers/demo/INDEX.md"),
    "---\nkind: manuscript\ntitle: Demo\n---\n",
    "utf8",
  );
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("POST /api/model/data/upload", () => {
  it("writes a file under papers/{slug}/notes/data/", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    const payload = Buffer.from("a,b\n1,2").toString("base64");
    try {
      const res = await request(server.app)
        .post("/api/model/data/upload")
        .send({ paperSlug: "demo", filename: "counts.csv", data: payload });
      expect(res.status).toBe(201);
      expect(res.body.path).toBe("papers/demo/notes/data/counts.csv");
      const saved = await readFile(path.join(modelRoot, "papers/demo/notes/data/counts.csv"), "utf8");
      expect(saved).toBe("a,b\n1,2");
    } finally {
      await server.close();
    }
  });

  it("400s on empty data", async () => {
    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const res = await request(server.app)
        .post("/api/model/data/upload")
        .send({ paperSlug: "demo", filename: "empty.csv", data: "" });
      expect(res.status).toBe(400);
    } finally {
      await server.close();
    }
  });
});
