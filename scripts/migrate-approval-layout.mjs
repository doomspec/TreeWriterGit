import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  path.join(fileURLToPath(new URL(".", import.meta.url)), "../view/backend/package.json"),
);
const matter = require("gray-matter");

const MODEL_ROOT = process.argv[2] ?? path.join(process.cwd(), "model");

async function walkUnits(dirRel, visit) {
  const abs = path.join(MODEL_ROOT, dirRel);
  if (!existsSync(abs)) return;
  const entries = await readdir(abs, { withFileTypes: true });
  const hasIndex = entries.some((entry) => entry.name === "INDEX.md");
  if (hasIndex && (existsSync(path.join(abs, "draft.md")) || existsSync(path.join(abs, "outline.md")))) {
    await visit(dirRel);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Descend into .trash; skip other dot dirs (.approval, .sessions, …).
    if (entry.name.startsWith(".") && entry.name !== ".trash") continue;
    await walkUnits(`${dirRel}/${entry.name}`, visit);
  }
}

function yamlValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `\n${value.map((item) => `  - ${yamlValue(item)}`).join("\n")}`;
  }
  return JSON.stringify(String(value));
}

function buildYaml(data) {
  return `${Object.entries(data)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join("\n")}\n`;
}

async function migrateUnit(unitRel) {
  const updated = [];
  const indexAbs = path.join(MODEL_ROOT, unitRel, "INDEX.md");
  if (!existsSync(indexAbs)) return updated;
  const index = matter(await readFile(indexAbs, "utf8"));
  const data = index.data;

  for (const kind of ["draft", "outline"]) {
    const prefix = kind === "outline" ? "outline_" : "";
    const legacyApproved = path.join(MODEL_ROOT, unitRel, `${kind}.approved.md`);
    const approvalDir = path.join(MODEL_ROOT, unitRel, ".approval");
    const modernApproved = path.join(approvalDir, `${kind}.approved.md`);
    const yamlPath = path.join(approvalDir, `${kind}.yaml`);

    if (!existsSync(legacyApproved) && !existsSync(modernApproved)) continue;

    await mkdir(approvalDir, { recursive: true });
    if (existsSync(legacyApproved) && !existsSync(modernApproved)) {
      await rename(legacyApproved, modernApproved);
      updated.push(`${unitRel}/.approval/${kind}.approved.md`);
    } else if (existsSync(legacyApproved) && existsSync(modernApproved)) {
      await rm(legacyApproved);
      updated.push(`${unitRel}/${kind}.approved.md (removed legacy duplicate)`);
    }

    if (!existsSync(yamlPath)) {
      const approvedBy = data[`${prefix}approved_by`] ?? null;
      const yaml = buildYaml({
        content_hash: null,
        git_commit: null,
        git_file_blob: null,
        approved_at: data[`${prefix}approved_at`] ?? null,
        approved_by: approvedBy,
        approvers: approvedBy ? [approvedBy] : [],
        edited_by: data[`${prefix}edited_by`] ?? null,
        edited_at: data[`${prefix}edited_at`] ?? null,
        ai_assisted: Boolean(data[`${prefix}ai_assisted`]),
        ai_provider: data[`${prefix}ai_provider`] ?? null,
        status: kind === "draft" ? (data.status ?? "outline") : "outline",
      });
      await writeFile(yamlPath, yaml, "utf8");
      updated.push(`${unitRel}/.approval/${kind}.yaml`);
    }
  }

  return updated;
}

async function main() {
  const updated = [];
  await walkUnits("papers", async (unitRel) => {
    updated.push(...(await migrateUnit(unitRel)));
  });
  console.log(`Migrated ${updated.length} approval artifacts under ${MODEL_ROOT}`);
  for (const rel of updated) console.log(`  ${rel}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
