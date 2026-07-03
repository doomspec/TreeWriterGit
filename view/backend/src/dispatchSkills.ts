import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";

const SKILLS_DIR_NAME = ".treewriter-skills";
const MAX_SKILL_BYTES = 256_000;

export type DispatchSkillInfo = {
  filename: string;
  title: string;
  size: number;
  enabled: boolean;
};

function skillsDirectory(repoRoot: string): string {
  return path.join(repoRoot, SKILLS_DIR_NAME);
}

export function sanitizeSkillFilename(name: string): string {
  const base = path.basename(name.trim());
  if (!base) throw new Error("Skill filename is required");

  const extMatch = base.match(/\.md$/i);
  if (!extMatch) throw new Error("Skill files must be .md");

  let stem = base.slice(0, -extMatch[0].length).trim();
  if (!stem) throw new Error("Skill filename is required");

  stem = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (!stem) {
    throw new Error("Skill filename must contain letters, numbers, dots, dashes, or underscores");
  }

  const safeName = `${stem.toLowerCase()}.md`;
  if (safeName.length <= 128) return safeName;
  return `${stem.slice(0, 125).toLowerCase()}.md`;
}

async function uniqueSkillFilename(dir: string, safeName: string): Promise<string> {
  if (!existsSync(path.join(dir, safeName))) return safeName;
  const stem = safeName.replace(/\.md$/i, "");
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem}-${index}.md`;
    if (!existsSync(path.join(dir, candidate))) return candidate;
  }
  throw new Error("Too many skills with the same name");
}

function skillTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  if (match?.[1]) return match[1].trim();
  return filename.replace(/\.md$/i, "").replace(/[-_]+/g, " ");
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

/** Explicit enabled filenames; null means all uploaded skills are active. */
export async function loadDispatchSkillsEnabled(repoRoot: string): Promise<string[] | null> {
  const parsed = await readTreewriterJson(repoRoot);
  const enabled = parsed.dispatchSkillsEnabled;
  if (!Array.isArray(enabled)) return null;
  return enabled.filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".md"));
}

export async function saveDispatchSkillsEnabled(
  repoRoot: string,
  enabled: string[],
): Promise<string[]> {
  const normalized = [...new Set(enabled.map(sanitizeSkillFilename))];
  const parsed = await readTreewriterJson(repoRoot);
  parsed.dispatchSkillsEnabled = normalized;
  await writeTreewriterJson(repoRoot, parsed);
  return normalized;
}

function isSkillEnabled(filename: string, enabled: string[] | null): boolean {
  if (enabled === null) return true;
  return enabled.includes(filename);
}

export async function listDispatchSkills(repoRoot: string): Promise<DispatchSkillInfo[]> {
  const dir = skillsDirectory(repoRoot);
  if (!existsSync(dir)) return [];

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const entries = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith(".md")).sort();

  const skills: DispatchSkillInfo[] = [];
  for (const filename of entries) {
    const abs = path.join(dir, filename);
    const content = await readFile(abs, "utf8");
    skills.push({
      filename,
      title: skillTitle(content, filename),
      size: Buffer.byteLength(content, "utf8"),
      enabled: isSkillEnabled(filename, enabled),
    });
  }
  return skills;
}

export async function saveDispatchSkill(
  repoRoot: string,
  filename: string,
  content: string,
): Promise<DispatchSkillInfo> {
  const dir = skillsDirectory(repoRoot);
  await mkdir(dir, { recursive: true });

  const safeName = await uniqueSkillFilename(dir, sanitizeSkillFilename(filename));
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes === 0) throw new Error("Skill file is empty");
  if (bytes > MAX_SKILL_BYTES) {
    throw new Error(`Skill file too large (max ${Math.round(MAX_SKILL_BYTES / 1024)}KB)`);
  }

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
  };
}

export async function readDispatchSkillContent(repoRoot: string, filename: string): Promise<string> {
  const safeName = sanitizeSkillFilename(filename);
  return readFile(path.join(skillsDirectory(repoRoot), safeName), "utf8");
}

export async function updateDispatchSkillContent(
  repoRoot: string,
  filename: string,
  content: string,
): Promise<DispatchSkillInfo> {
  const safeName = sanitizeSkillFilename(filename);
  const abs = path.join(skillsDirectory(repoRoot), safeName);
  if (!existsSync(abs)) throw new Error(`Skill not found: ${safeName}`);

  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes === 0) throw new Error("Skill file is empty");
  if (bytes > MAX_SKILL_BYTES) {
    throw new Error(`Skill file too large (max ${Math.round(MAX_SKILL_BYTES / 1024)}KB)`);
  }
  await writeFile(abs, content, "utf8");

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  return {
    filename: safeName,
    title: skillTitle(content, safeName),
    size: bytes,
    enabled: isSkillEnabled(safeName, enabled),
  };
}

/** Renames a skill file in place, preserving its enabled/disabled state under the new name. */
export async function renameDispatchSkill(
  repoRoot: string,
  filename: string,
  newFilename: string,
): Promise<DispatchSkillInfo> {
  const safeOld = sanitizeSkillFilename(filename);
  const dir = skillsDirectory(repoRoot);
  const oldAbs = path.join(dir, safeOld);
  if (!existsSync(oldAbs)) throw new Error(`Skill not found: ${safeOld}`);

  const safeNew = sanitizeSkillFilename(newFilename);
  if (safeNew === safeOld) {
    const content = await readFile(oldAbs, "utf8");
    const enabled = await loadDispatchSkillsEnabled(repoRoot);
    return {
      filename: safeOld,
      title: skillTitle(content, safeOld),
      size: Buffer.byteLength(content, "utf8"),
      enabled: isSkillEnabled(safeOld, enabled),
    };
  }
  if (existsSync(path.join(dir, safeNew))) {
    throw new Error(`A skill named ${safeNew} already exists`);
  }

  const content = await readFile(oldAbs, "utf8");
  await writeFile(path.join(dir, safeNew), content, "utf8");
  await unlink(oldAbs);

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const wasEnabled = isSkillEnabled(safeOld, enabled);
  if (enabled !== null && enabled.includes(safeOld)) {
    await saveDispatchSkillsEnabled(repoRoot, [
      ...enabled.filter((name) => name !== safeOld),
      safeNew,
    ]);
  }

  return {
    filename: safeNew,
    title: skillTitle(content, safeNew),
    size: Buffer.byteLength(content, "utf8"),
    enabled: wasEnabled,
  };
}

export async function deleteDispatchSkill(repoRoot: string, filename: string): Promise<void> {
  const safeName = sanitizeSkillFilename(filename);
  const abs = path.join(skillsDirectory(repoRoot), safeName);
  await unlink(abs);

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  if (enabled !== null) {
    const next = enabled.filter((name) => name !== safeName);
    await saveDispatchSkillsEnabled(repoRoot, next);
  }
}

/** Markdown block appended to every dispatch prompt (before manuscript markup rules). */
export async function gatherDispatchSkillBlock(repoRoot: string): Promise<string> {
  const dir = skillsDirectory(repoRoot);
  if (!existsSync(dir)) return "";

  const enabled = await loadDispatchSkillsEnabled(repoRoot);
  const filenames = (await readdir(dir))
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .filter((name) => isSkillEnabled(name, enabled))
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
