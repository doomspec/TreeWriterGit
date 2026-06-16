import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { buildGraph, parseWikilinks, resolveTarget } from "./graph.js";

let root: string;

async function writeUnit(rel: string, frontmatter: Record<string, unknown>, body = ""): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(abs, "INDEX.md"), matter.stringify(`# ${rel}\n${body}`, frontmatter), "utf8");
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "twg-graph-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("parseWikilinks", () => {
  it("extracts plain, embed, aliased, and anchored links", () => {
    const text = "see [[intro]] and ![[fig-1]] and [[results|the results]] and [[methods#setup]]";
    expect(parseWikilinks(text)).toEqual(["intro", "fig-1", "results", "methods"]);
  });

  it("returns nothing when there are no links", () => {
    expect(parseWikilinks("plain text")).toEqual([]);
  });
});

describe("resolveTarget", () => {
  const ids = new Set(["a/b/intro", "a/b/results", "notes/lit/ref"]);
  const byBase = new Map<string, string[]>([
    ["intro", ["a/b/intro"]],
    ["results", ["a/b/results"]],
    ["ref", ["notes/lit/ref"]]
  ]);

  it("resolves a relative link from the source dir", () => {
    expect(resolveTarget("../results", "a/b/intro", ids, byBase)).toBe("a/b/results");
  });

  it("resolves by unique basename", () => {
    expect(resolveTarget("ref", "a/b/intro", ids, byBase)).toBe("notes/lit/ref");
  });

  it("returns null for an unknown target", () => {
    expect(resolveTarget("nope", "a/b/intro", ids, byBase)).toBeNull();
  });
});

describe("buildGraph", () => {
  it("creates one node per folder, folding INDEX.md (not a separate node)", async () => {
    await writeUnit("intro", { kind: "unit", title: "Introduction" });
    await writeUnit("methods", { kind: "section", title: "Methods" });
    const graph = await buildGraph(root);
    const ids = graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["intro", "methods"]);
    expect(graph.nodes.find((n) => n.id === "intro")?.type).toBe("unit");
    expect(graph.nodes.find((n) => n.id === "methods")?.label).toBe("Methods");
  });

  it("builds an edge from a frontmatter link and counts degree", async () => {
    await writeUnit("intro", { kind: "unit", links: ["[[../discussion]]"] });
    await writeUnit("discussion", { kind: "section" });
    const graph = await buildGraph(root);
    expect(graph.edges).toContainEqual({ source: "intro", target: "discussion" });
    expect(graph.nodes.find((n) => n.id === "intro")?.links).toBe(1);
    expect(graph.nodes.find((n) => n.id === "discussion")?.links).toBe(1);
  });

  it("builds an edge from a body wikilink", async () => {
    await writeUnit("problem", { kind: "unit" }, "addressed in [[../solution]]");
    await writeUnit("solution", { kind: "unit" });
    const graph = await buildGraph(root);
    expect(graph.edges).toContainEqual({ source: "problem", target: "solution" });
  });

  it("folds draft.md links into the unit node", async () => {
    await writeUnit("problem", { kind: "unit" });
    await writeFile(path.join(root, "problem", "draft.md"), "see [[../evidence]]\n", "utf8");
    await writeUnit("evidence", { kind: "unit" });
    const graph = await buildGraph(root);
    expect(graph.nodes.some((n) => n.id === "problem/draft")).toBe(false);
    expect(graph.edges).toContainEqual({ source: "problem", target: "evidence" });
  });

  it("emits a missing node for an unresolved link", async () => {
    await writeUnit("intro", { kind: "unit" }, "see [[ghost-section]]");
    const graph = await buildGraph(root);
    const missing = graph.nodes.find((n) => n.type === "missing");
    expect(missing?.id).toBe("missing:ghost-section");
    expect(graph.edges).toContainEqual({ source: "intro", target: "missing:ghost-section" });
  });

  it("treats standalone notes as their own nodes", async () => {
    await mkdir(path.join(root, "notes", "lit"), { recursive: true });
    await writeFile(
      path.join(root, "notes", "lit", "ref.md"),
      matter.stringify("# Ref\n", { cite_key: "ref-2020" }),
      "utf8"
    );
    await writeUnit("intro", { kind: "unit" }, "per [[ref]]");
    const graph = await buildGraph(root);
    expect(graph.nodes.some((n) => n.id === "notes/lit/ref")).toBe(true);
    expect(graph.edges).toContainEqual({ source: "intro", target: "notes/lit/ref" });
    expect(graph.nodes.find((n) => n.id === "notes/lit/ref")?.type).toBe("note");
  });
});
