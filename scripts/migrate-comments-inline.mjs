import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";

const MODEL_ROOT = process.argv[2] ?? path.join(process.cwd(), "model");

function sidecarRel(fileRel) {
  const paperMatch = fileRel.match(/^papers\/([^/]+)\/(.+)$/);
  if (paperMatch) {
    const [, slug, rest] = paperMatch;
    if (rest.startsWith("sections/")) {
      return `papers/${slug}/sections/.comments/${rest.slice("sections/".length)}.comments.json`;
    }
    return `papers/${slug}/.comments/${rest}.comments.json`;
  }
  return `.comments/${fileRel}.comments.json`;
}

function renderTag(comment) {
  const attrs = [`id="${comment.id}"`, `author="${comment.author}"`];
  if (comment.resolved) attrs.push('resolved="true"');
  if (comment.assigned_to) {
    attrs.push(
      `assigned_to="${comment.assigned_to.type}:${comment.assigned_to.id}:${comment.assigned_to.label}"`,
    );
  }
  if (comment.assigned_by) attrs.push(`assigned_by="${comment.assigned_by}"`);
  if (comment.assigned_at) attrs.push(`assigned_at="${comment.assigned_at}"`);
  return `<comment ${attrs.join(" ")}>${comment.text}</comment>`;
}

function insertAtLine(markdown, line, tag) {
  const lines = markdown.split("\n");
  const index = Math.max(0, Math.min(lines.length - 1, line - 1));
  lines[index] = `${lines[index] ?? ""} ${tag}`.trimEnd();
  return lines.join("\n");
}

async function walkComments(dirRel, visit) {
  const abs = path.join(MODEL_ROOT, dirRel);
  if (!existsSync(abs)) return;
  const entries = await readdir(abs, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = `${dirRel}/${entry.name}`;
    if (entry.isDirectory()) {
      await walkComments(childRel, visit);
    } else if (entry.name.endsWith(".comments.json")) {
      await visit(childRel);
    }
  }
}

async function migrateSidecar(sidecarRelPath) {
  const abs = path.join(MODEL_ROOT, sidecarRelPath);
  const raw = await readFile(abs, "utf8");
  const comments = JSON.parse(raw);
  if (!Array.isArray(comments) || comments.length === 0) return null;

  const fileRel = comments[0]?.file;
  if (!fileRel) return null;
  const manuscriptAbs = path.join(MODEL_ROOT, fileRel);
  if (!existsSync(manuscriptAbs)) return null;

  let markdown = await readFile(manuscriptAbs, "utf8");
  for (const comment of comments.sort((a, b) => a.line - b.line)) {
    markdown = insertAtLine(markdown, comment.line, renderTag(comment));
  }
  await writeFile(manuscriptAbs, markdown, "utf8");
  await rm(abs);
  return fileRel;
}

async function main() {
  const migrated = [];
  await walkComments(".comments", async (sidecarRelPath) => {
    const fileRel = await migrateSidecar(sidecarRelPath);
    if (fileRel) migrated.push(fileRel);
  });
  await walkComments("papers", async (sidecarRelPath) => {
    if (!sidecarRelPath.includes("/.comments/")) return;
    const fileRel = await migrateSidecar(sidecarRelPath);
    if (fileRel) migrated.push(fileRel);
  });
  console.log(`Migrated inline comments for ${migrated.length} files`);
  for (const rel of migrated) console.log(`  ${rel}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
