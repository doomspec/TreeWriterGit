#!/usr/bin/env node
/**
 * One-time migration: flat .treewriter-skills/*.md → system/ + user/ layout.
 * Run: node scripts/migrate-skills-layout.mjs
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const skillsRoot = path.join(repoRoot, ".treewriter-skills");
const systemDir = path.join(skillsRoot, "system");
const userDir = path.join(skillsRoot, "user");
const seedsDir = path.join(systemDir, ".seeds");

const SYSTEM_RULES = new Set([
  "treewriter-context-cli.md",
  "treewriter-structure-and-assets.md",
]);

const SYSTEM_ACTION_PREFIX = "dispatch-";

const USER_FILES = new Set([
  "writing-deslop-basics.md",
  "scientific-writing-framework-skill.md",
  "scientific-writing-framework-reference.md",
  "technology-paper-skill.md",
]);

function isSystemFile(name) {
  if (SYSTEM_RULES.has(name)) return true;
  if (name.startsWith(SYSTEM_ACTION_PREFIX) && name.endsWith(".md")) return true;
  return false;
}

async function migrateConfig() {
  const configPath = path.join(repoRoot, ".treewriter.json");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const enabled = Array.isArray(parsed.dispatchSkillsEnabled) ? parsed.dispatchSkillsEnabled : [];
  parsed.dispatchSkillsEnabled = enabled
    .map((entry) => (typeof entry === "string" ? path.basename(entry) : entry))
    .filter((name) => typeof name === "string" && USER_FILES.has(name) || !SYSTEM_RULES.has(name) && !String(name).startsWith(SYSTEM_ACTION_PREFIX));
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log("Updated .treewriter.json dispatchSkillsEnabled");
}

async function main() {
  if (existsSync(systemDir) || existsSync(userDir)) {
    console.log("system/ or user/ already exists — skipping file moves (config still updated).");
    await migrateConfig();
    return;
  }

  await mkdir(systemDir, { recursive: true });
  await mkdir(userDir, { recursive: true });
  await mkdir(seedsDir, { recursive: true });

  const entries = await readdir(skillsRoot);
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    if (name === "SKILLS-AUDIT.md") continue;
    const src = path.join(skillsRoot, name);
    if (isSystemFile(name)) {
      const dest = path.join(systemDir, name);
      await rename(src, dest);
      await copyFile(dest, path.join(seedsDir, name));
      console.log("system:", name);
    } else if (USER_FILES.has(name) || !name.startsWith("_")) {
      const dest = path.join(userDir, name);
      await rename(src, dest);
      console.log("user:", name);
    }
  }

  await writeFile(
    path.join(systemDir, "README.md"),
    `# System skills (repo-owned)

- \`treewriter-*.md\` — always appended on every dispatch preview
- \`dispatch-*.md\` — per-action prompt templates (loaded for matching action only)

Do not delete these files. Edit in the Skills UI; use **Reset** to restore from \`.seeds/\`.
`,
    "utf8",
  );

  await migrateConfig();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
