import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";
import request from "supertest";

import { createTestServer } from "../test/createTestApp.js";

let repoRoot: string;
let modelRoot: string;

async function seedPaperWithOrphanRef(): Promise<void> {
  const paperRel = "papers/demo";
  await mkdir(path.join(modelRoot, paperRel, "introduction", "claim"), { recursive: true });

  await writeFile(
    path.join(modelRoot, paperRel, "INDEX.md"),
    matter.stringify("", {
      kind: "paper",
      title: "Demo Paper",
      section_order: ["introduction"],
    }),
    "utf8",
  );

  await writeFile(
    path.join(modelRoot, paperRel, "introduction", "INDEX.md"),
    matter.stringify("", {
      kind: "section",
      title: "Introduction",
      child_order: ["claim"],
    }),
    "utf8",
  );

  await writeFile(
    path.join(modelRoot, paperRel, "introduction", "claim", "INDEX.md"),
    matter.stringify("", { kind: "unit", title: "Claim", status: "approved" }),
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, paperRel, "introduction", "claim", "outline.md"),
    "# Claim\n\n",
    "utf8",
  );
  await writeFile(
    path.join(modelRoot, paperRel, "introduction", "claim", "draft.md"),
    "See orphan \\ref{fig:missing} here.\n",
    "utf8",
  );
}

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-export-contract-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("export API contract", () => {
  it("returns 422 when blockOnOrphanRefs is enabled and orphan cross-refs exist", async () => {
    await seedPaperWithOrphanRef();
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      `${JSON.stringify({ export: { blockOnOrphanRefs: true } }, null, 2)}\n`,
      "utf8",
    );

    const server = createTestServer({ repoRoot, modelRoot });
    try {
      const agent = request(server.app);
      const res = await agent.post("/api/export").send({
        paperSlug: "demo",
        format: "docx",
        includeDrafts: false,
      });

      expect(res.status).toBe(422);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.stringMatching(/orphan cross-references/i),
        }),
      );
      expect(String(res.body.error)).toContain("fig:missing");
    } finally {
      await server.close();
    }
  });
});
