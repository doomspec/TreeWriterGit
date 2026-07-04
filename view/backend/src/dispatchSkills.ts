import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import matter from "gray-matter";

import type { DispatchAction } from "./agentDispatch/templates.js";

const SKILLS_DIR_NAME = ".treewriter-skills";
const SYSTEM_SUBDIR = "system";
const USER_SUBDIR = "user";
const SEEDS_SUBDIR = "system/.seeds";
const MAX_SKILL_BYTES = 256_000;

export type DispatchSkillTier = "system" | "user";
export type DispatchSkillSubkind = "rule" | "action";

export type DispatchSkillInfo = {
  filename: string;
  title: string;
  size: number;
  enabled: boolean;
  tier: DispatchSkillTier;
  subkind: DispatchSkillSubkind;
  /** API path: system/foo.md or user/foo.md */
  skillPath: string;
};

export class DispatchSkillError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "DispatchSkillError";
  }
}

function skillsDirectory(repoRoot: string): string {
  return path.join(repoRoot, SKILLS_DIR_NAME);
}

function systemSkillsDirectory(repoRoot: string): string {
  return path.join(skillsDirectory(repoRoot), SYSTEM_SUBDIR);
}

function userSkillsDirectory(repoRoot: string): string {
  return path.join(skillsDirectory(repoRoot), USER_SUBDIR);
}

function seedsDirectory(repoRoot: string): string {
  return path.join(skillsDirectory(repoRoot), SEEDS_SUBDIR);
}

function usesTierLayout(repoRoot: string): boolean {
  return (
    existsSync(systemSkillsDirectory(repoRoot)) || existsSync(userSkillsDirectory(repoRoot))
  );
}

export function isDispatchActionFilename(filename: string): boolean {
  return filename.toLowerCase().startsWith("dispatch-") && filename.toLowerCase().endsWith(".md");
}

function isSystemTreewriterRule(filename: string): boolean {
  return filename.toLowerCase().startsWith("treewriter-") && filename.toLowerCase().endsWith(".md");
}

function dispatchActionFromFilename(filename: string): DispatchAction | null {
  if (!isDispatchActionFilename(filename)) return null;
  const action = filename.slice("dispatch-".length, -".md".length);
  return action as DispatchAction;
}

function skillSubkind(filename: string, tier: DispatchSkillTier): DispatchSkillSubkind {
  if (tier === "system" && isDispatchActionFilename(filename)) return "action";
  return "rule";
}

export function sanitizeSkillFilename(name: string): string {
  const base = path.basename(name.trim());
  if (!base) throw new DispatchSkillError("Skill filename is required");

  const extMatch = base.match(/\.md$/i);
  if (!extMatch) throw new DispatchSkillError("Skill files must be .md");

  let stem = base.slice(0, -extMatch[0].length).trim();
  if (!stem) throw new DispatchSkillError("Skill filename is required");

  stem = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (!stem) {
    throw new DispatchSkillError(
      "Skill filename must contain letters, numbers, dots, dashes, or underscores",
    );
  }

  const safeName = `${stem.toLowerCase()}.md`;
  if (safeName.length <= 128) return safeName;
  return `${stem.slice(0, 125).toLowerCase()}.md`;
}

/** Parse skillPath (system/foo.md, user/foo.md, or legacy foo.md). */
function parseSkillPath(
  repoRoot: string,
  input: string,
): { tier: DispatchSkillTier; filename: string; skillPath: string } {
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith(`${SYSTEM_SUBDIR}/`)) {
    const filename = sanitizeSkillFilename(normalized.slice(SYSTEM_SUBDIR.length + 1));
    return { tier: "system", filename, skillPath: `${SYSTEM_SUBDIR}/${filename}` };
  }
  if (normalized.startsWith(`${USER_SUBDIR}/`)) {
    const filename = sanitizeSkillFilename(normalized.slice(USER_SUBDIR.length + 1));
    return { tier: "user", filename, skillPath: `${USER_SUBDIR}/${filename}` };
  }
  const filename = sanitizeSkillFilename(normalized);
  if (usesTierLayout(repoRoot)) {
    throw new DispatchSkillError(`Use ${USER_SUBDIR}/ or ${SYSTEM_SUBDIR}/ prefix for skill paths`);
  }
  return { tier: "user", filename, skillPath: filename };
}

function resolveSkillAbsPath(repoRoot: string, skillPath: string): string {
  const normalized = skillPath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new DispatchSkillError("Invalid skill path");
  }
  const abs = path.join(skillsDirectory(repoRoot), normalized);
  const base = skillsDirectory(repoRoot);
  if (!abs.startsWith(base)) {
    throw new DispatchSkillError("Invalid skill path");
  }
  return abs;
}

async function uniqueSkillFilename(dir: string, safeName: string): Promise<string> {
  if (!existsSync(path.join(dir, safeName))) return safeName;
  const stem = safeName.replace(/\.md$/i, "");
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem}-${index}.md`;
    if (!existsSync(path.join(dir, candidate))) return candidate;
  }
  throw new DispatchSkillError("Too many skills with the same name");
}

function skillTitle(content: string, filename: string): string {
  const parsed = matter(content);
  const fromFrontmatter = parsed.data.label ?? parsed.data.title;
  if (typeof fromFrontmatter === "string" && fromFrontmatter.trim()) {
    return fromFrontmatter.trim();
  }
  const match = parsed.content.match(/^#\s+(.+?)\s*$/m);
  if (match?.[1]) return match[1].trim();
  return filename.replace(/\.md$/i, "").replace(/[-_]+/g, " ");
}

function stripSkillBody(content: string): string {
  const parsed = matter(content);
  return parsed.content.trim();
}

async function readTreewriterJson(repoRoot: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(repoRoot, ".treewriter.json"), "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeTreewriterJson(repoRoot: string, parsed: Record<string, unknown>): Promise<void> {
  await writeFile(
    path.join(repoRoot, ".treewriter.json"),
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8",
  );
}

/** Explicit enabled user skill filenames (basename only); null means all user skills active. */
export async function loadDispatchSkillsEnabled(repoRoot: string): Promise<string[] | null> {
  const parsed = await readTreewriterJson(repoRoot);
  const enabled = parsed.dispatchSkillsEnabled;
  if (!Array.isArray(enabled)) return null;
  return enabled
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".md"))
    .map((entry) => sanitizeSkillFilename(entry.replace(/^user\//, "")));
}

export async function saveDispatchSkillsEnabled(
  repoRoot: string,
  enabled: string[],
): Promise<string[]> {
  const normalized = [...new Set(enabled.map((name) => sanitizeSkillFilename(name.replace(/^user\//, ""))))];
  const parsed = await readTreewriterJson(repoRoot);
  parsed.dispatchSkillsEnabled = normalized;
  await writeTreewriterJson(repoRoot, parsed);
  return normalized;
}

function isUserSkillEnabled(filename: string, enabled: string[] | null): boolean {
  if (enabled === null) return true;
  return enabled.includes(filename);
}

async function buildSkillInfo(
  repoRoot: string,
  tier: DispatchSkillTier,
  filename: string,
  enabled: string[] | null,
): Promise<DispatchSkillInfo> {
  const skillPath = `${tier}/${filename}`;
  const abs = resolveSkillAbsPath(repoRoot, skillPath);
  const content = await readFile(abs, "utf8");
  return {
    filename,
    title: skillTitle(content, filename),
    size: Buffer.byteLength(content, "utf8"),
    enabled: tier === "system" ? true : isUserSkillEnabled(filename, enabled),
    tier,
    subkind: skillSubkind(filename, tier),
    skillPath,
  };
}

async function listTierSkills(repoRoot: string, tier: DispatchSkillTier): Promise<DispatchSkillInfo[]> {
  const dir = tier === "system" ? systemSkillsDirectory(repoRoot) : userSkillsDirectory(repoRoot);
  if (!existsSync(dir)) return [];

  const enabled = tier === "user" ? await loadDispatchSkillsEnabled(repoRoot) : null;
  const entries = (await readdir(dir))
    .filter((name) => name.toLowerCase().endsWith(".md") && !name.startsWith("."))
    .sort();

  const skills: DispatchSkillInfo[] = [];
  for (const filename of entries) {
    skills.push(await buildSkillInfo(repoRoot, tier, filename, enabled));
  }
  return skills;
}

async function listLegacyFlatSkills(repoRoot: string): Promise<DispatchSkillInfo[]> {
  const dir = skillsDirectory(repoRoot);
  if (!existsSync(dir)) return [];

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const entries = (await readdir(dir))
    .filter((name) => name.toLowerCase().endsWith(".md") && !name.startsWith("."))
    .sort();

  const skills: DispatchSkillInfo[] = [];
  for (const filename of entries) {
    if (filename === "SKILLS-AUDIT.md") continue;
    skills.push({
      filename,
      title: skillTitle(await readFile(path.join(dir, filename), "utf8"), filename),
      size: Buffer.byteLength(await readFile(path.join(dir, filename), "utf8"), "utf8"),
      enabled: isUserSkillEnabled(filename, enabled),
      tier: isDispatchActionFilename(filename) || isSystemTreewriterRule(filename) ? "system" : "user",
      subkind: isDispatchActionFilename(filename) ? "action" : "rule",
      skillPath: filename,
    });
  }
  return skills;
}

export async function listDispatchSkills(repoRoot: string): Promise<DispatchSkillInfo[]> {
  if (!usesTierLayout(repoRoot)) {
    return listLegacyFlatSkills(repoRoot);
  }
  const system = await listTierSkills(repoRoot, "system");
  const user = await listTierSkills(repoRoot, "user");
  return [...system, ...user];
}

export async function saveDispatchSkill(
  repoRoot: string,
  filename: string,
  content: string,
): Promise<DispatchSkillInfo> {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes === 0) throw new DispatchSkillError("Skill file is empty");
  if (bytes > MAX_SKILL_BYTES) {
    throw new DispatchSkillError(`Skill file too large (max ${Math.round(MAX_SKILL_BYTES / 1024)}KB)`);
  }

  if (usesTierLayout(repoRoot)) {
    const dir = userSkillsDirectory(repoRoot);
    await mkdir(dir, { recursive: true });
    const safeName = await uniqueSkillFilename(dir, sanitizeSkillFilename(filename));
    await writeFile(path.join(dir, safeName), content, "utf8");

    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    if (enabled !== null && !enabled.includes(safeName)) {
      await saveDispatchSkillsEnabled(repoRoot, [...enabled, safeName]);
    }
    return buildSkillInfo(repoRoot, "user", safeName, enabled);
  }

  const dir = skillsDirectory(repoRoot);
  await mkdir(dir, { recursive: true });
  const safeName = await uniqueSkillFilename(dir, sanitizeSkillFilename(filename));
  await writeFile(path.join(dir, safeName), content, "utf8");

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  if (enabled !== null && !enabled.includes(safeName)) {
    await saveDispatchSkillsEnabled(repoRoot, [...enabled, safeName]);
  }

  return {
    filename: safeName,
    title: skillTitle(content, safeName),
    size: bytes,
    enabled: true,
    tier: "user",
    subkind: "rule",
    skillPath: safeName,
  };
}

export async function readDispatchSkillContent(repoRoot: string, skillPathInput: string): Promise<string> {
  if (usesTierLayout(repoRoot)) {
    const normalized = skillPathInput.replace(/\\/g, "/");
    if (normalized.includes("/")) {
      return readFile(resolveSkillAbsPath(repoRoot, normalized), "utf8");
    }
    for (const tier of ["system", "user"] as const) {
      const candidate = `${tier}/${sanitizeSkillFilename(normalized)}`;
      const abs = resolveSkillAbsPath(repoRoot, candidate);
      if (existsSync(abs)) return readFile(abs, "utf8");
    }
    throw new DispatchSkillError(`Skill not found: ${skillPathInput}`, 404);
  }
  const safeName = sanitizeSkillFilename(skillPathInput);
  return readFile(path.join(skillsDirectory(repoRoot), safeName), "utf8");
}

export async function updateDispatchSkillContent(
  repoRoot: string,
  skillPathInput: string,
  content: string,
): Promise<DispatchSkillInfo> {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes === 0) throw new DispatchSkillError("Skill file is empty");
  if (bytes > MAX_SKILL_BYTES) {
    throw new DispatchSkillError(`Skill file too large (max ${Math.round(MAX_SKILL_BYTES / 1024)}KB)`);
  }

  let skillPath: string;
  if (usesTierLayout(repoRoot)) {
    const normalized = skillPathInput.replace(/\\/g, "/");
    if (normalized.includes("/")) {
      skillPath = normalized;
    } else {
      let found: string | null = null;
      for (const tier of ["system", "user"] as const) {
        const candidate = `${tier}/${sanitizeSkillFilename(normalized)}`;
        if (existsSync(resolveSkillAbsPath(repoRoot, candidate))) {
          found = candidate;
          break;
        }
      }
      if (!found) throw new DispatchSkillError(`Skill not found: ${skillPathInput}`, 404);
      skillPath = found;
    }
  } else {
    skillPath = sanitizeSkillFilename(skillPathInput);
  }

  const abs = resolveSkillAbsPath(repoRoot, skillPath);
  if (!existsSync(abs)) throw new DispatchSkillError(`Skill not found: ${skillPathInput}`, 404);
  await writeFile(abs, content, "utf8");

  if (!usesTierLayout(repoRoot)) {
    const safeName = sanitizeSkillFilename(skillPath);
    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    return {
      filename: safeName,
      title: skillTitle(content, safeName),
      size: bytes,
      enabled: isUserSkillEnabled(safeName, enabled),
      tier: "user",
      subkind: "rule",
      skillPath: safeName,
    };
  }

  const tier = skillPath.startsWith(`${SYSTEM_SUBDIR}/`) ? "system" : "user";
  const filename = path.basename(skillPath);
  const enabled = tier === "user" ? await loadDispatchSkillsEnabled(repoRoot) : null;
  return buildSkillInfo(repoRoot, tier, filename, enabled);
}

export async function renameDispatchSkill(
  repoRoot: string,
  skillPathInput: string,
  newFilename: string,
): Promise<DispatchSkillInfo> {
  if (usesTierLayout(repoRoot)) {
    const normalized = skillPathInput.replace(/\\/g, "/");
    if (normalized.startsWith(`${SYSTEM_SUBDIR}/`)) {
      throw new DispatchSkillError("System skills cannot be renamed", 403);
    }
    const tier = "user";
    const oldFilename = sanitizeSkillFilename(
      normalized.includes("/") ? path.basename(normalized) : normalized,
    );
    const dir = userSkillsDirectory(repoRoot);
    const oldAbs = path.join(dir, oldFilename);
    if (!existsSync(oldAbs)) throw new DispatchSkillError(`Skill not found: ${skillPathInput}`, 404);

    const safeNew = sanitizeSkillFilename(newFilename);
    if (safeNew === oldFilename) {
      return buildSkillInfo(repoRoot, tier, oldFilename, await loadDispatchSkillsEnabled(repoRoot));
    }
    if (existsSync(path.join(dir, safeNew))) {
      throw new DispatchSkillError(`A skill named ${safeNew} already exists`);
    }

    const content = await readFile(oldAbs, "utf8");
    await writeFile(path.join(dir, safeNew), content, "utf8");
    await unlink(oldAbs);

    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    if (enabled !== null && enabled.includes(oldFilename)) {
      await saveDispatchSkillsEnabled(repoRoot, [
        ...enabled.filter((name) => name !== oldFilename),
        safeNew,
      ]);
    }
    const enabledAfter = await loadDispatchSkillsEnabled(repoRoot);
    return buildSkillInfo(repoRoot, tier, safeNew, enabledAfter);
  }

  const safeOld = sanitizeSkillFilename(skillPathInput);
  const dir = skillsDirectory(repoRoot);
  const oldAbs = path.join(dir, safeOld);
  if (!existsSync(oldAbs)) throw new DispatchSkillError(`Skill not found: ${safeOld}`, 404);

  const safeNew = sanitizeSkillFilename(newFilename);
  if (safeNew === safeOld) {
    const content = await readFile(oldAbs, "utf8");
    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    return {
      filename: safeOld,
      title: skillTitle(content, safeOld),
      size: Buffer.byteLength(content, "utf8"),
      enabled: isUserSkillEnabled(safeOld, enabled),
      tier: "user",
      subkind: "rule",
      skillPath: safeOld,
    };
  }
  if (existsSync(path.join(dir, safeNew))) {
    throw new DispatchSkillError(`A skill named ${safeNew} already exists`);
  }

  const content = await readFile(oldAbs, "utf8");
  await writeFile(path.join(dir, safeNew), content, "utf8");
  await unlink(oldAbs);

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  if (enabled !== null && enabled.includes(safeOld)) {
    await saveDispatchSkillsEnabled(repoRoot, [
      ...enabled.filter((name) => name !== safeOld),
      safeNew,
    ]);
  }

  const enabledAfter = await loadDispatchSkillsEnabled(repoRoot);
  return {
    filename: safeNew,
    title: skillTitle(content, safeNew),
    size: Buffer.byteLength(content, "utf8"),
    enabled: isUserSkillEnabled(safeNew, enabledAfter),
    tier: "user",
    subkind: "rule",
    skillPath: safeNew,
  };
}

export async function deleteDispatchSkill(repoRoot: string, skillPathInput: string): Promise<void> {
  if (usesTierLayout(repoRoot)) {
    const normalized = skillPathInput.replace(/\\/g, "/");
    if (normalized.startsWith(`${SYSTEM_SUBDIR}/`) || (!normalized.includes("/") && existsSync(path.join(systemSkillsDirectory(repoRoot), sanitizeSkillFilename(normalized))))) {
      throw new DispatchSkillError("System skills cannot be deleted", 403);
    }
    const filename = sanitizeSkillFilename(
      normalized.includes("/") ? path.basename(normalized) : normalized,
    );
    const abs = path.join(userSkillsDirectory(repoRoot), filename);
    await unlink(abs);

    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    if (enabled !== null) {
      await saveDispatchSkillsEnabled(repoRoot, enabled.filter((name) => name !== filename));
    }
    return;
  }

  const safeName = sanitizeSkillFilename(skillPathInput);
  await unlink(path.join(skillsDirectory(repoRoot), safeName));

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  if (enabled !== null) {
    await saveDispatchSkillsEnabled(repoRoot, enabled.filter((name) => name !== safeName));
  }
}

export async function resetSystemSkill(repoRoot: string, skillPathInput: string): Promise<DispatchSkillInfo> {
  const normalized = skillPathInput.replace(/\\/g, "/");
  const skillPath = normalized.startsWith(`${SYSTEM_SUBDIR}/`)
    ? normalized
    : `${SYSTEM_SUBDIR}/${sanitizeSkillFilename(normalized)}`;
  if (!skillPath.startsWith(`${SYSTEM_SUBDIR}/`)) {
    throw new DispatchSkillError("Only system skills can be reset", 400);
  }

  const seedPath = path.join(seedsDirectory(repoRoot), path.basename(skillPath));
  const targetAbs = resolveSkillAbsPath(repoRoot, skillPath);
  if (!existsSync(seedPath)) {
    throw new DispatchSkillError(`No seed file for ${path.basename(skillPath)}`, 404);
  }
  await mkdir(path.dirname(targetAbs), { recursive: true });
  await copyFile(seedPath, targetAbs);

  const filename = path.basename(skillPath);
  return buildSkillInfo(repoRoot, "system", filename, null);
}

function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

/** Load per-action prompt body from system/dispatch-{action}.md; null if missing. */
export async function loadDispatchActionTemplate(
  repoRoot: string,
  action: DispatchAction,
): Promise<string | null> {
  const filename = `dispatch-${action}.md`;
  if (usesTierLayout(repoRoot)) {
    const abs = path.join(systemSkillsDirectory(repoRoot), filename);
    if (!existsSync(abs)) return null;
    return stripSkillBody(await readFile(abs, "utf8"));
  }
  const legacyAbs = path.join(skillsDirectory(repoRoot), filename);
  if (!existsSync(legacyAbs)) return null;
  return stripSkillBody(await readFile(legacyAbs, "utf8"));
}

export function renderDispatchActionTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return substituteTemplate(template, vars);
}

/** Markdown block appended to every dispatch prompt (before manuscript markup rules). */
export async function gatherDispatchSkillBlock(repoRoot: string): Promise<string> {
  if (!usesTierLayout(repoRoot)) {
    return gatherLegacyDispatchSkillBlock(repoRoot);
  }

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const parts: string[] = [];

  const systemDir = systemSkillsDirectory(repoRoot);
  if (existsSync(systemDir)) {
    const systemFiles = (await readdir(systemDir))
      .filter((name) => name.toLowerCase().endsWith(".md") && isSystemTreewriterRule(name))
      .sort();
    for (const filename of systemFiles) {
      const content = stripSkillBody(await readFile(path.join(systemDir, filename), "utf8"));
      if (!content) continue;
      parts.push(`--- system/${filename} ---\n${content}`);
    }
  }

  const userDir = userSkillsDirectory(repoRoot);
  if (existsSync(userDir)) {
    const userFiles = (await readdir(userDir))
      .filter((name) => name.toLowerCase().endsWith(".md") && !name.startsWith("."))
      .filter((name) => isUserSkillEnabled(name, enabled))
      .sort();
    for (const filename of userFiles) {
      const content = stripSkillBody(await readFile(path.join(userDir, filename), "utf8"));
      if (!content) continue;
      parts.push(`--- user/${filename} ---\n${content}`);
    }
  }

  if (parts.length === 0) return "";

  return [
    "DISPATCH SKILLS (follow these instructions for this task;",
    "apply them together with the manuscript markup rules that follow):",
    "",
    parts.join("\n\n"),
  ].join("\n");
}

async function gatherLegacyDispatchSkillBlock(repoRoot: string): Promise<string> {
  const dir = skillsDirectory(repoRoot);
  if (!existsSync(dir)) return "";

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const filenames = (await readdir(dir))
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .filter((name) => !isDispatchActionFilename(name))
    .filter((name) => name !== "SKILLS-AUDIT.md")
    .filter((name) => isUserSkillEnabled(name, enabled))
    .sort();

  if (filenames.length === 0) return "";

  const parts: string[] = [];
  for (const filename of filenames) {
    const content = (await readFile(path.join(dir, filename), "utf8")).trim();
    if (!content) continue;
    parts.push(`--- ${filename} ---\n${content}`);
  }

  if (parts.length === 0) return "";

  return [
    "DISPATCH SKILLS (follow these instructions for this task;",
    "apply them together with the manuscript markup rules that follow):",
    "",
    parts.join("\n\n"),
  ].join("\n");
}

export { dispatchActionFromFilename };
