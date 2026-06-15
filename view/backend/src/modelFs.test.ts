import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import {
  ModelFsError,
  createFile,
  createNode,
  deleteNode,
  indexSkeleton,
  moveNode,
  reorderChildren,
  resolveModelPath,
  toRelative
} from "./modelFs.js";

let root: string;

async function seedContainer(rel: string, childOrder: string[] = []): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    matter.stringify(`# ${rel}\n`, { kind: "section", child_order: childOrder }),
    "utf8"
  );
}

async function childOrderOf(rel: string): Promise<string[]> {
  const parsed = matter(await readFile(path.join(root, rel, "INDEX.md"), "utf8"));
  return (parsed.data.child_order as string[]) ?? [];
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "twg-modelfs-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("resolveModelPath", () => {
  it("resolves nested paths under root", () => {
    const abs = resolveModelPath(root, "papers/ml/sections");
    expect(abs).toBe(path.join(root, "papers/ml/sections"));
  });

  it("rejects traversal above root", () => {
    expect(() => resolveModelPath(root, "../../etc/passwd")).toThrow(ModelFsError);
    expect(() => resolveModelPath(root, "papers/../../escape")).toThrow(/escapes model root/);
  });

  it("round-trips through toRelative", () => {
    const abs = resolveModelPath(root, "a/b/c");
    expect(toRelative(root, abs)).toBe("a/b/c");
  });
});

describe("indexSkeleton", () => {
  it("marks a unit with status outline and no child_order", () => {
    const { data } = matter(indexSkeleton("problem", "unit"));
    expect(data.kind).toBe("unit");
    expect(data.status).toBe("outline");
    expect(data).not.toHaveProperty("child_order");
  });

  it("gives a container an empty child_order", () => {
    const { data } = matter(indexSkeleton("introduction", "section"));
    expect(data.kind).toBe("section");
    expect(data.child_order).toEqual([]);
  });
});

describe("createNode", () => {
  beforeEach(async () => {
    await seedContainer("sections", []);
  });

  it("creates a container and appends it to parent child_order", async () => {
    const rel = await createNode(root, "sections", "introduction", "section");
    expect(rel).toBe("sections/introduction");
    expect(existsSync(path.join(root, rel, "INDEX.md"))).toBe(true);
    expect(existsSync(path.join(root, rel, "draft.md"))).toBe(false);
    expect(await childOrderOf("sections")).toEqual(["introduction"]);
  });

  it("creates a unit with INDEX.md + draft.md", async () => {
    await createNode(root, "sections", "introduction", "section");
    const rel = await createNode(root, "sections/introduction", "problem", "unit");
    expect(existsSync(path.join(root, rel, "INDEX.md"))).toBe(true);
    expect(existsSync(path.join(root, rel, "draft.md"))).toBe(true);
    const { data } = matter(await readFile(path.join(root, rel, "INDEX.md"), "utf8"));
    expect(data.status).toBe("outline");
    expect(await childOrderOf("sections/introduction")).toEqual(["problem"]);
  });

  it("appends multiple children in creation order", async () => {
    await createNode(root, "sections", "introduction", "section");
    await createNode(root, "sections", "methods", "section");
    expect(await childOrderOf("sections")).toEqual(["introduction", "methods"]);
  });

  it("rejects a duplicate node with 409", async () => {
    await createNode(root, "sections", "introduction", "section");
    await expect(createNode(root, "sections", "introduction", "section")).rejects.toMatchObject({
      status: 409
    });
  });

  it("rejects an invalid name with 400", async () => {
    await expect(createNode(root, "sections", "a/b", "section")).rejects.toMatchObject({
      status: 400
    });
    await expect(createNode(root, "sections", ".hidden", "unit")).rejects.toMatchObject({
      status: 400
    });
  });
});

describe("deleteNode", () => {
  beforeEach(async () => {
    await seedContainer("sections", []);
    await createNode(root, "sections", "introduction", "section");
    await createNode(root, "sections/introduction", "problem", "unit");
  });

  it("deletes a leaf unit and drops it from parent child_order", async () => {
    await deleteNode(root, "sections/introduction/problem");
    expect(existsSync(path.join(root, "sections/introduction/problem"))).toBe(false);
    expect(await childOrderOf("sections/introduction")).toEqual([]);
  });

  it("refuses a non-empty container without recursive", async () => {
    await expect(deleteNode(root, "sections/introduction")).rejects.toMatchObject({ status: 409 });
    expect(existsSync(path.join(root, "sections/introduction"))).toBe(true);
  });

  it("deletes a non-empty container with recursive", async () => {
    await deleteNode(root, "sections/introduction", true);
    expect(existsSync(path.join(root, "sections/introduction"))).toBe(false);
    expect(await childOrderOf("sections")).toEqual([]);
  });

  it("throws 404 for a missing path", async () => {
    await expect(deleteNode(root, "sections/nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("moveNode", () => {
  beforeEach(async () => {
    await seedContainer("sections", []);
    await seedContainer("archive", []);
    await createNode(root, "sections", "introduction", "section");
  });

  it("moves a node and updates both parents' child_order", async () => {
    await moveNode(root, "sections/introduction", "archive/introduction");
    expect(existsSync(path.join(root, "archive/introduction/INDEX.md"))).toBe(true);
    expect(await childOrderOf("sections")).toEqual([]);
    expect(await childOrderOf("archive")).toEqual(["introduction"]);
  });

  it("rejects move onto an existing path with 409", async () => {
    await createNode(root, "archive", "introduction", "section");
    await expect(moveNode(root, "sections/introduction", "archive/introduction")).rejects.toMatchObject(
      { status: 409 }
    );
  });
});

describe("reorderChildren", () => {
  beforeEach(async () => {
    await seedContainer("sections", []);
    await createNode(root, "sections", "introduction", "section");
    await createNode(root, "sections", "methods", "section");
    await createNode(root, "sections", "results", "section");
  });

  it("rewrites child_order in the given order", async () => {
    await reorderChildren(root, "sections", ["results", "introduction", "methods"]);
    expect(await childOrderOf("sections")).toEqual(["results", "introduction", "methods"]);
  });

  it("rejects a non-array order with 400", async () => {
    // @ts-expect-error testing runtime guard
    await expect(reorderChildren(root, "sections", "nope")).rejects.toMatchObject({ status: 400 });
  });
});

describe("createFile", () => {
  it("creates a file and its parent directories", async () => {
    await createFile(root, "papers/ml/notes/literature/ref.md", "# Ref\n");
    expect(await readFile(path.join(root, "papers/ml/notes/literature/ref.md"), "utf8")).toContain(
      "# Ref"
    );
  });

  it("rejects overwriting an existing file with 409", async () => {
    await createFile(root, "a.md", "x");
    await expect(createFile(root, "a.md", "y")).rejects.toMatchObject({ status: 409 });
  });
});
