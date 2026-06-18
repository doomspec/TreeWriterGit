import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listPaperEquations, resolveEquationMetadata } from "./equations.js";
import { createNode } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-equations-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("equations", () => {
  it("lists equation units under a paper", async () => {
    const paperRel = "papers/demo";
    await createNode(modelRoot, "papers", "demo", "section");
    await createNode(modelRoot, paperRel, "equations", "section");
    await createNode(modelRoot, `${paperRel}/equations`, "main-result", "equation");

    const equations = await listPaperEquations(modelRoot, paperRel);
    expect(equations).toHaveLength(1);
    expect(equations[0]?.path).toBe(`${paperRel}/equations/main-result`);
    expect(equations[0]?.sourcePath).toBe(`${paperRel}/equations/main-result/source.tex`);
  });

  it("resolves equation metadata", async () => {
    const paperRel = "papers/demo";
    await createNode(modelRoot, "papers", "demo", "section");
    await createNode(modelRoot, paperRel, "equations", "section");
    const eqRel = await createNode(modelRoot, `${paperRel}/equations`, "loss", "equation");

    const meta = await resolveEquationMetadata(modelRoot, eqRel);
    expect(meta?.kind).toBe("equation-unit");
    expect(meta?.title).toBe("Loss");
    expect(meta?.sourcePath).toBe(`${eqRel}/source.tex`);
  });
});
