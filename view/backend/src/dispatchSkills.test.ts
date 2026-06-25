import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPreview } from "./agentDispatch.js";
import {
  gatherDispatchSkillBlock,
  listDispatchSkills,
  sanitizeSkillFilename,
  saveDispatchSkill,
  saveDispatchSkillsEnabled,
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
    expect(guide?.title).toMatch(/TreeWriter Repository Guide/i);

    const deslop = skills.find((skill) => skill.filename === "writing-deslop-basics.md");
    expect(deslop).toBeDefined();
    expect(deslop?.title).toMatch(/Deslop Basics/i);
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
});
