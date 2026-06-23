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
  isUnitDir,
  materializeOutline,
  materializeDraft,
  moveNode,
  orderedChildren,
  reorderChildren,
  resolveModelPath,
  shellQuote,
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
    expect(existsSync(path.join(root, rel, "outline.md"))).toBe(true);
    expect(existsSync(path.join(root, rel, "draft.md"))).toBe(false);
    expect(await childOrderOf("sections")).toEqual(["introduction"]);
  });

  it("creates a unit with INDEX.md, outline.md, and draft.md", async () => {
    await createNode(root, "sections", "introduction", "section");
    const rel = await createNode(root, "sections/introduction", "problem", "unit");
    expect(existsSync(path.join(root, rel, "INDEX.md"))).toBe(true);
    expect(existsSync(path.join(root, rel, "outline.md"))).toBe(true);
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
    await expect(createNode(root, "sections", "bad;name", "unit")).rejects.toMatchObject({
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

  it("updates INDEX title and outline heading when the folder is renamed", async () => {
    await createNode(root, "sections", "hardware_problem", "unit");
    await moveNode(root, "sections/hardware_problem", "sections/problem_1");

    const index = matter(await readFile(path.join(root, "sections/problem_1/INDEX.md"), "utf8"));
    expect(index.data.title).toBe("Problem 1");

    const outline = await readFile(path.join(root, "sections/problem_1/outline.md"), "utf8");
    expect(outline.startsWith("# Problem 1\n")).toBe(true);
  });

  it("updates a custom INDEX title when the folder is renamed", async () => {
    await createNode(root, "sections", "hardware_problem", "unit");
    const indexPath = path.join(root, "sections/hardware_problem/INDEX.md");
    const parsed = matter(await readFile(indexPath, "utf8"));
    parsed.data.title = "Problem 1";
    await writeFile(indexPath, matter.stringify(parsed.content, parsed.data), "utf8");
    await writeFile(
      path.join(root, "sections/hardware_problem/outline.md"),
      "# Problem 1\n\nOverview:\n- Point one.\n",
      "utf8",
    );

    await moveNode(root, "sections/hardware_problem", "sections/problem_hardware");

    const index = matter(await readFile(path.join(root, "sections/problem_hardware/INDEX.md"), "utf8"));
    expect(index.data.title).toBe("Problem Hardware");
    const outline = await readFile(path.join(root, "sections/problem_hardware/outline.md"), "utf8");
    expect(outline.startsWith("# Problem Hardware\n")).toBe(true);
  });
});

async function sectionOrderOf(rel: string): Promise<string[]> {
  const parsed = matter(await readFile(path.join(root, rel, "INDEX.md"), "utf8"));
  return (parsed.data.section_order as string[]) ?? [];
}

async function seedPaper(rel: string, sectionOrder: string[] = []): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    matter.stringify("\n", { kind: "paper", slug: "test", section_order: sectionOrder }),
    "utf8",
  );
}

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

  it("rewrites section_order on paper folders", async () => {
    await seedPaper("papers/ml-study", []);
    await createNode(root, "papers/ml-study", "introduction", "section");
    await createNode(root, "papers/ml-study", "methods", "section");
    await createNode(root, "papers/ml-study", "results", "section");
    await reorderChildren(root, "papers/ml-study", ["results", "introduction", "methods"]);
    expect(await sectionOrderOf("papers/ml-study")).toEqual(["results", "introduction", "methods"]);
  });
});

describe("materializeOutline", () => {
  it("creates outline.md from INDEX body when missing", async () => {
    await seedContainer("sections", []);
    const indexBody = "# Intro\n\n## Summary\n\nHello.\n";
    await writeFile(
      path.join(root, "sections/INDEX.md"),
      matter.stringify(indexBody, { kind: "section", child_order: [] }),
      "utf8",
    );
    const content = await materializeOutline(root, "sections/outline.md");
    expect(content).toContain("Hello.");
    expect(existsSync(path.join(root, "sections/outline.md"))).toBe(true);
  });
});

describe("materializeDraft", () => {
  it("creates blank draft.md when outline.md exists", async () => {
    await seedContainer("sections/intro", []);
    await writeFile(path.join(root, "sections/intro/outline.md"), "# Intro\n\n", "utf8");
    const content = await materializeDraft(root, "sections/intro/draft.md");
    expect(content).toBe("");
    expect(existsSync(path.join(root, "sections/intro/draft.md"))).toBe(true);
  });

  it("returns existing draft content", async () => {
    await seedContainer("sections/intro", []);
    await writeFile(path.join(root, "sections/intro/outline.md"), "# Intro\n\n", "utf8");
    await writeFile(path.join(root, "sections/intro/draft.md"), "Body text\n", "utf8");
    const content = await materializeDraft(root, "sections/intro/draft.md");
    expect(content).toBe("Body text\n");
  });

  it("404 when outline.md is missing", async () => {
    await seedContainer("sections/intro", []);
    await expect(materializeDraft(root, "sections/intro/draft.md")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("shellQuote", () => {
  it("wraps paths safely for shell", () => {
    expect(shellQuote("papers/foo/draft.md")).toBe("'papers/foo/draft.md'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

describe("isUnitDir", () => {
  it("detects units by kind and legacy draft.md fallback", async () => {
    await seedContainer("sections", ["legacy"]);
    await createNode(root, "sections", "typed-unit", "unit");
    await mkdir(path.join(root, "sections/legacy"), { recursive: true });
    await writeFile(path.join(root, "sections/legacy/draft.md"), "x", "utf8");
    expect(await isUnitDir(root, "sections/typed-unit")).toBe(true);
    expect(await isUnitDir(root, "sections/introduction")).toBe(false);
    expect(await isUnitDir(root, "sections/legacy")).toBe(true);
  });
});

describe("orderedChildren", () => {
  beforeEach(async () => {
    await seedContainer("sections", []);
    await createNode(root, "sections", "introduction", "section");
    await createNode(root, "sections", "orphan-on-disk", "section");
    await reorderChildren(root, "sections", ["introduction"]);
  });

  it("appends on-disk children missing from child_order", async () => {
    const children = await orderedChildren(root, "sections");
    expect(children).toContain("introduction");
    expect(children).toContain("orphan-on-disk");
  });
});

describe("createNode asset containers", () => {
  it("does not add figures/tables/equations to a paper section_order", async () => {
    await mkdir(path.join(root, "papers/demo"), { recursive: true });
    await writeFile(
      path.join(root, "papers/demo/INDEX.md"),
      matter.stringify("# Demo\n", {
        kind: "paper",
        section_order: ["introduction"],
      }),
      "utf8",
    );
    await mkdir(path.join(root, "papers/demo/introduction"), { recursive: true });
    await writeFile(
      path.join(root, "papers/demo/introduction/INDEX.md"),
      matter.stringify("", { kind: "section", title: "Introduction" }),
      "utf8",
    );
    await createNode(root, "papers/demo", "figures", "section");
    await createNode(root, "papers/demo", "tables", "section");
    await createNode(root, "papers/demo", "equations", "section");

    const paperIndex = matter(await readFile(path.join(root, "papers/demo/INDEX.md"), "utf8"));
    expect(paperIndex.data.section_order).toEqual(["introduction"]);

    const children = await orderedChildren(root, "papers/demo");
    expect(children).toEqual(["introduction"]);
  });

  it("still updates child_order when adding assets under an asset folder", async () => {
    await seedContainer("papers/demo/figures", []);
    await createNode(root, "papers/demo/figures", "fig1", "figure");

    const figuresIndex = matter(
      await readFile(path.join(root, "papers/demo/figures/INDEX.md"), "utf8"),
    );
    expect(figuresIndex.data.child_order).toEqual(["fig1"]);
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
