import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPreview } from "./agentDispatch.js";
import {
  gatherDispatchSkillBlock,
  listDispatchSkills,
  loadDispatchActionTemplate,
  readDispatchSkillContent,
  renameDispatchSkill,
  sanitizeSkillFilename,
  saveDispatchSkill,
  saveDispatchSkillsEnabled,
  updateDispatchSkillContent,
  deleteDispatchSkill,
} from "./dispatchSkills.js";

let repoRoot: string;
let modelRoot: string;

const provider = {
  name: "Claude Code",
  command: "claude",
  args: ["-p", "{prompt}"],
  writesFiles: true,
};

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-skills-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

async function makeUnit(unitPath: string) {
  const abs = path.join(modelRoot, unitPath);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    "---\nkind: unit\nstatus: outline\nlinks: []\n---\n",
    "utf8",
  );
  await writeFile(path.join(abs, "outline.md"), "# Title\n\nIdea.\n", "utf8");
  await writeFile(path.join(abs, "draft.md"), "", "utf8");
}

describe("dispatchSkills", () => {
  it("sanitizes common upload filenames instead of rejecting them", () => {
    expect(sanitizeSkillFilename("SKILL.MD")).toBe("skill.md");
    expect(sanitizeSkillFilename("My Writing Skill.md")).toBe("my-writing-skill.md");
    expect(sanitizeSkillFilename("writer's guide.md")).toBe("writer-s-guide.md");
    expect(sanitizeSkillFilename("../nested/evil/SKILL.md")).toBe("skill.md");
  });

  it("includes the default repo guide skill in the repository", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const skills = await listDispatchSkills(repoRoot);
    const guide = skills.find((skill) => skill.filename === "treewriter-structure-and-assets.md");
    expect(guide).toBeDefined();
    expect(guide?.tier).toBe("system");
    expect(guide?.title).toMatch(/TreeWriter Repository Guide/i);

    const deslop = skills.find((skill) => skill.filename === "writing-deslop-basics.md");
    expect(deslop).toBeDefined();
    expect(deslop?.tier).toBe("user");
    expect(deslop?.title).toMatch(/Deslop Basics/i);
  });

  it("excludes dispatch action templates from the global skill block", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const block = await gatherDispatchSkillBlock(repoRoot);
    expect(block).not.toContain("dispatch-draft.md");
    expect(block).toContain("treewriter-context-cli");
  });

  it("loads dispatch action template from system skills", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const body = await loadDispatchActionTemplate(repoRoot, "draft");
    expect(body).toBeTruthy();
    expect(body).toContain("{outputPath}");
  });

  it("forbids deleting system skills", async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    if (!existsSync(path.join(repoRoot, ".treewriter-skills", "system"))) return;
    await expect(
      deleteDispatchSkill(repoRoot, "system/treewriter-context-cli.md"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deduplicates repeated SKILL.md uploads", async () => {
    await saveDispatchSkill(repoRoot, "SKILL.md", "# First\n");
    const second = await saveDispatchSkill(repoRoot, "SKILL.md", "# Second\n");
    expect(second.filename).toBe("skill-2.md");
    expect(await listDispatchSkills(repoRoot)).toHaveLength(2);
  });

  it("lists uploaded skills with titles from headings", async () => {
    await saveDispatchSkill(repoRoot, "style.md", "# Scientific tone\n\nUse active voice.");
    const skills = await listDispatchSkills(repoRoot);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.title).toBe("Scientific tone");
    expect(skills[0]?.enabled).toBe(true);
  });

  it("respects enabled subset in config", async () => {
    await saveDispatchSkill(repoRoot, "a.md", "# A\n");
    await saveDispatchSkill(repoRoot, "b.md", "# B\n");
    await saveDispatchSkillsEnabled(repoRoot, ["a.md"]);

    const block = await gatherDispatchSkillBlock(repoRoot);
    expect(block).toContain("--- a.md ---");
    expect(block).not.toContain("--- b.md ---");

    const skills = await listDispatchSkills(repoRoot);
    expect(skills.find((s) => s.filename === "b.md")?.enabled).toBe(false);
  });

  it("injects enabled skills into buildPreview before manuscript markup", async () => {
    await makeUnit("intro/unit");
    await saveDispatchSkill(repoRoot, "rules.md", "# Extra rule\n\nNever use passive voice in abstracts.");

    const result = await buildPreview(modelRoot, repoRoot, "intro/unit", "draft", provider);
    const skillIndex = result.prompt.indexOf("DISPATCH SKILLS");
    const markupIndex = result.prompt.indexOf("MANUSCRIPT MARKUP");
    expect(skillIndex).toBeGreaterThan(-1);
    expect(markupIndex).toBeGreaterThan(skillIndex);
    expect(result.prompt).toContain("Never use passive voice in abstracts.");
  });

  it("reads back a skill's content", async () => {
    await saveDispatchSkill(repoRoot, "style.md", "# Scientific tone\n\nUse active voice.");
    expect(await readDispatchSkillContent(repoRoot, "style.md")).toBe(
      "# Scientific tone\n\nUse active voice.",
    );
  });

  it("updates a skill's content in place, preserving its filename and enabled state", async () => {
    await saveDispatchSkill(repoRoot, "style.md", "# Scientific tone\n\nUse active voice.");
    await saveDispatchSkillsEnabled(repoRoot, []);

    const updated = await updateDispatchSkillContent(repoRoot, "style.md", "# Scientific Tone v2\n\nBe concise.");
    expect(updated.filename).toBe("style.md");
    expect(updated.title).toBe("Scientific Tone v2");
    expect(updated.enabled).toBe(false);
    expect(await readDispatchSkillContent(repoRoot, "style.md")).toBe(
      "# Scientific Tone v2\n\nBe concise.",
    );
  });

  it("renames a skill, preserving content and its place in the enabled list", async () => {
    await saveDispatchSkill(repoRoot, "old-name.md", "# Old Name\n\nBody.");
    await saveDispatchSkillsEnabled(repoRoot, ["old-name.md"]);

    const renamed = await renameDispatchSkill(repoRoot, "old-name.md", "New Name.md");
    expect(renamed.filename).toBe("new-name.md");
    expect(renamed.enabled).toBe(true);
    expect(await readDispatchSkillContent(repoRoot, "new-name.md")).toBe("# Old Name\n\nBody.");

    const skills = await listDispatchSkills(repoRoot);
    expect(skills.map((s) => s.filename)).toEqual(["new-name.md"]);
  });

  it("refuses to rename onto an existing skill", async () => {
    await saveDispatchSkill(repoRoot, "a.md", "# A\n");
    await saveDispatchSkill(repoRoot, "b.md", "# B\n");
    await expect(renameDispatchSkill(repoRoot, "a.md", "b.md")).rejects.toThrow(/already exists/);
  });

  it("update/rename throw when the skill doesn't exist", async () => {
    await expect(updateDispatchSkillContent(repoRoot, "ghost.md", "# X\n")).rejects.toThrow(/not found/);
    await expect(renameDispatchSkill(repoRoot, "ghost.md", "real.md")).rejects.toThrow(/not found/);
  });
});
