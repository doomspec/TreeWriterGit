import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createNode } from "../model/crud.js";
import { walkManuscriptLeaves } from "./walk.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "tw-walk-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("walkManuscriptLeaves", () => {
  it("visits units in child_order", async () => {
    await createNode(root, "papers/demo", "intro", "section");
    await createNode(root, "papers/demo/intro", "u1", "unit");
    await createNode(root, "papers/demo/intro", "u2", "unit");

    const visited: string[] = [];
    await walkManuscriptLeaves(root, "papers/demo/intro", async (ctx) => {
      if (ctx.kind === "unit") visited.push(ctx.name);
    });

    expect(visited).toEqual(["u1", "u2"]);
  });
});
