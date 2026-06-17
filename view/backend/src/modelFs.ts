import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm, stat, readdir } from "node:fs/promises";
import matter from "gray-matter";

export type NodeKind = "section" | "subsection" | "unit" | "figure" | "table";

export class ModelFsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ModelFsError";
  }
}

/** Resolve a model-relative path to an absolute path, rejecting any escape above modelRoot. */
export function resolveModelPath(modelRoot: string, relativePath: string): string {
  const absolutePath = path.resolve(modelRoot, relativePath || ".");
  if (absolutePath !== modelRoot && !absolutePath.startsWith(`${modelRoot}${path.sep}`)) {
    throw new ModelFsError("Path escapes model root", 400);
  }
  return absolutePath;
}

export function toRelative(modelRoot: string, absolutePath: string): string {
  return path.relative(modelRoot, absolutePath).split(path.sep).join("/");
}

function titleCase(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function assertNodeName(name: string): void {
  if (!name || name === "." || name === "..") {
    throw new ModelFsError(`Invalid node name: ${JSON.stringify(name)}`, 400);
  }
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
    throw new ModelFsError(`Invalid node name: ${JSON.stringify(name)}`, 400);
  }
}

/** Shell-safe single-quoted string for embedding in terminal commands. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const SKIP_CHILDREN = new Set(["notes", ".sessions", ".trash"]);

export async function readIndexData(
  modelRoot: string,
  relPath: string,
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(modelRoot, relPath, "INDEX.md"), "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function resolveChildPath(
  modelRoot: string,
  parentRel: string,
  childName: string,
): string | null {
  const direct = `${parentRel}/${childName}`;
  if (existsSync(path.join(modelRoot, direct))) return direct;
  const underSections = `${parentRel}/sections/${childName}`;
  if (existsSync(path.join(modelRoot, underSections))) return underSections;
  return null;
}

const FIGURE_ASSET_PATTERN = /\.(png|jpe?g|svg|mmd|gif|webp)$/i;

/** True when folder is a table leaf (kind: table). */
export async function isTableDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "table") return true;
  if (
    data.kind === "unit" ||
    data.kind === "figure" ||
    data.kind === "section" ||
    data.kind === "subsection" ||
    data.kind === "paper"
  ) {
    return false;
  }
  return false;
}

/** True when folder is a figure leaf (kind: figure or outline+draft+asset heuristic). */
export async function isFigureDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "table") return false;
  if (data.kind === "figure") return true;
  if (data.kind === "unit" || data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }

  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) return false;

  const entries = await readdir(abs, { withFileTypes: true });
  const hasChildDir = entries.some(
    (entry) => entry.isDirectory() && entry.name !== ".sessions" && entry.name !== "notes",
  );
  if (hasChildDir) return false;

  const hasOutline = existsSync(path.join(abs, "outline.md"));
  const hasDraft = existsSync(path.join(abs, "draft.md"));
  const hasAsset = entries.some((entry) => entry.isFile() && FIGURE_ASSET_PATTERN.test(entry.name));
  return hasOutline && hasDraft && hasAsset;
}

/** True when folder is a leaf unit (kind-based with draft.md fallback for legacy trees). */
export async function isUnitDir(modelRoot: string, relPath: string): Promise<boolean> {
  const data = await readIndexData(modelRoot, relPath);
  if (data.kind === "figure" || data.kind === "table") return false;
  if (data.kind === "unit") return true;
  if (data.kind === "section" || data.kind === "subsection" || data.kind === "paper") {
    return false;
  }
  if (!existsSync(path.join(modelRoot, relPath, "draft.md"))) return false;
  if (await isFigureDir(modelRoot, relPath)) return false;
  return true;
}

/** Merge frontmatter child_order/section_order with on-disk directories (stable, deduped). */
export async function orderedChildren(modelRoot: string, dirRel: string): Promise<string[]> {
  const data = await readIndexData(modelRoot, dirRel);
  const sectionOrder = Array.isArray(data.section_order) ? (data.section_order as string[]) : [];
  let childOrder = Array.isArray(data.child_order) ? (data.child_order as string[]) : [];

  const sectionsRoot = `${dirRel}/sections`;
  if (sectionOrder.length === 0 && existsSync(path.join(modelRoot, sectionsRoot))) {
    const sectionsData = await readIndexData(modelRoot, sectionsRoot);
    childOrder = Array.isArray(sectionsData.child_order)
      ? (sectionsData.child_order as string[])
      : childOrder;
  }

  const order = sectionOrder.length > 0 ? sectionOrder : childOrder;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of order) {
    if (SKIP_CHILDREN.has(name)) continue;
    const childRel = resolveChildPath(modelRoot, dirRel, name);
    if (!childRel) continue;
    seen.add(name);
    result.push(name);
  }

  try {
    const entries = await readdir(path.join(modelRoot, dirRel), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_CHILDREN.has(entry.name) || seen.has(entry.name)) continue;
      if (entry.name === "sections" && order.length > 0) continue;
      result.push(entry.name);
    }
  } catch {
    // ignore unreadable dirs
  }

  return result;
}

/** Technical metadata only — hidden from authors in the UI. */
export function indexSkeleton(name: string, kind: NodeKind): string {
  const title = titleCase(name);
  if (kind === "unit") {
    return matter.stringify("\n", { kind: "unit", title, status: "outline", links: [] });
  }
  if (kind === "figure") {
    return matter.stringify("\n", {
      kind: "figure",
      title,
      status: "outline",
      figure_source: "source.mmd",
      figure_preview: null,
      links: [],
    });
  }
  if (kind === "table") {
    return matter.stringify("\n", {
      kind: "table",
      title,
      status: "outline",
      table_label: null,
      links: [],
    });
  }
  return matter.stringify("\n", {
    kind,
    title,
    child_order: [],
    links: [],
    composed_at_commit: null,
  });
}

/** User-facing section overview — visible as "Outline" in the UI. */
export function outlineDocSkeleton(name: string, kind: NodeKind): string {
  const title = titleCase(name);
  if (kind === "unit") {
    return `# ${title}\n\nOverview: _what this paragraph covers in the manuscript — main point, evidence, and citations._\n`;
  }
  if (kind === "figure") {
    return `# ${title}\n\n## Summary\n\n_Describe panels, axes, data sources, and what the reader should take away._\n`;
  }
  if (kind === "table") {
    return `# ${title}\n\n## Summary\n\n_Describe rows, columns, statistics, and what the reader should take away._\n`;
  }
  return `# ${title}\n\n## Summary\n\n_Overview of this section for authors and readers._\n\n## Outline\n\n`;
}

const indexPathFor = (parentRel: string): string =>
  parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";

type OrderKey = "child_order" | "section_order";

function orderKeyFor(data: Record<string, unknown>): OrderKey {
  if (data.kind === "paper") return "section_order";
  if (Array.isArray(data.section_order) && data.section_order.length > 0) return "section_order";
  return "child_order";
}

async function patchNodeOrder(
  modelRoot: string,
  parentRel: string,
  mutate: (order: string[]) => string[],
): Promise<void> {
  const indexRel = indexPathFor(parentRel);
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    return;
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const key = orderKeyFor(parsed.data as Record<string, unknown>);
  const current: string[] = Array.isArray(parsed.data[key]) ? (parsed.data[key] as string[]) : [];
  const data = { ...parsed.data, [key]: mutate([...current]) };
  await writeFile(indexAbs, matter.stringify(parsed.content, data), "utf8");
}

/** Create outline.md from INDEX.md body when missing (lazy migration). */
export async function materializeOutline(modelRoot: string, outlineRel: string): Promise<string> {
  const normalized = outlineRel.split(path.sep).join("/");
  if (normalized !== "outline.md" && !normalized.endsWith("/outline.md")) {
    throw new ModelFsError("Not an outline path", 400);
  }
  const outlineAbs = resolveModelPath(modelRoot, normalized);
  if (existsSync(outlineAbs)) {
    return readFile(outlineAbs, "utf8");
  }
  const dir = path.posix.dirname(normalized);
  const parentRel = dir === "." ? "" : dir;
  const indexRel = parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    throw new ModelFsError(`No INDEX.md for ${normalized}`, 404);
  }
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const fm = parsed.data as Record<string, unknown>;
  let content = parsed.content.trim();
  if (!content) {
    const name = parentRel ? path.posix.basename(parentRel) : "model";
    const rawKind = String(fm.kind ?? "section");
    const kind: NodeKind =
      rawKind === "unit" ||
      rawKind === "figure" ||
      rawKind === "table" ||
      rawKind === "subsection" ||
      rawKind === "section"
        ? rawKind
        : "section";
    content = outlineDocSkeleton(name, kind);
  }
  if (!content.endsWith("\n")) {
    content += "\n";
  }
  await mkdir(path.dirname(outlineAbs), { recursive: true });
  await writeFile(outlineAbs, content, "utf8");
  return content;
}

/** Create blank draft.md when outline.md exists but draft is missing. */
export async function materializeDraft(modelRoot: string, draftRel: string): Promise<string> {
  const normalized = draftRel.split(path.sep).join("/");
  if (normalized !== "draft.md" && !normalized.endsWith("/draft.md")) {
    throw new ModelFsError("Not a draft path", 400);
  }
  const draftAbs = resolveModelPath(modelRoot, normalized);
  if (existsSync(draftAbs)) {
    return readFile(draftAbs, "utf8");
  }
  const dir = path.posix.dirname(normalized);
  const parentRel = dir === "." ? "" : dir;
  const outlineRel = parentRel ? `${parentRel}/outline.md` : "outline.md";
  const outlineAbs = resolveModelPath(modelRoot, outlineRel);
  if (!existsSync(outlineAbs)) {
    throw new ModelFsError(`No outline.md for ${normalized}`, 404);
  }
  await mkdir(path.dirname(draftAbs), { recursive: true });
  await writeFile(draftAbs, "", "utf8");
  return "";
}

export async function createFile(
  modelRoot: string,
  relativePath: string,
  content = ""
): Promise<string> {
  const abs = resolveModelPath(modelRoot, relativePath);
  if (existsSync(abs)) {
    throw new ModelFsError(`Already exists: ${relativePath}`, 409);
  }
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  return relativePath;
}

/** Create a container (section/subsection) or unit node, updating the parent INDEX child_order. */
export async function createNode(
  modelRoot: string,
  parentRel: string,
  name: string,
  kind: NodeKind
): Promise<string> {
  assertNodeName(name);
  const nodeRel = parentRel ? `${parentRel}/${name}` : name;
  const abs = resolveModelPath(modelRoot, nodeRel);
  if (existsSync(abs)) {
    throw new ModelFsError(`Already exists: ${nodeRel}`, 409);
  }
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(abs, "INDEX.md"), indexSkeleton(name, kind), "utf8");
  await writeFile(path.join(abs, "outline.md"), outlineDocSkeleton(name, kind), "utf8");
  if (kind === "unit" || kind === "figure" || kind === "table") {
    await writeFile(
      path.join(abs, "draft.md"),
      kind === "figure"
        ? `**${titleCase(name)}.** _Caption text._\n`
        : kind === "table"
          ? `**${titleCase(name)}.** _Caption text._\n\n| Column A | Column B |\n| --- | --- |\n|  |  |\n`
          : "",
      "utf8",
    );
  }
  if (kind === "figure") {
    await writeFile(
      path.join(abs, "source.mmd"),
      "flowchart TD\n  A[Start] --> B[End]\n",
      "utf8",
    );
  }
  await patchNodeOrder(modelRoot, parentRel, (order) =>
    order.includes(name) ? order : [...order, name],
  );
  return nodeRel;
}

export async function deleteNode(
  modelRoot: string,
  relativePath: string,
  recursive = false
): Promise<void> {
  const abs = resolveModelPath(modelRoot, relativePath);
  if (abs === modelRoot) {
    throw new ModelFsError("Refusing to delete model root", 400);
  }
  if (!existsSync(abs)) {
    throw new ModelFsError(`Not found: ${relativePath}`, 404);
  }
  const info = await stat(abs);
  if (info.isDirectory()) {
    const entries = (await readdir(abs)).filter(
      (e) => e !== "INDEX.md" && e !== "outline.md" && e !== "draft.md",
    );
    if (entries.length > 0 && !recursive) {
      throw new ModelFsError(`Directory not empty: ${relativePath}`, 409);
    }
    await rm(abs, { recursive: true, force: true });
  } else {
    await rm(abs, { force: true });
  }
  await patchNodeOrder(modelRoot, path.posix.dirname(relativePath).replace(/^\.$/, ""), (order) =>
    order.filter((n) => n !== path.posix.basename(relativePath)),
  );
}

export async function moveNode(modelRoot: string, from: string, to: string): Promise<void> {
  const fromAbs = resolveModelPath(modelRoot, from);
  const toAbs = resolveModelPath(modelRoot, to);
  if (!existsSync(fromAbs)) {
    throw new ModelFsError(`Not found: ${from}`, 404);
  }
  if (existsSync(toAbs)) {
    throw new ModelFsError(`Already exists: ${to}`, 409);
  }
  await mkdir(path.dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
  const fromParent = path.posix.dirname(from).replace(/^\.$/, "");
  const toParent = path.posix.dirname(to).replace(/^\.$/, "");
  await patchNodeOrder(modelRoot, fromParent, (order) =>
    order.filter((n) => n !== path.posix.basename(from)),
  );
  await patchNodeOrder(modelRoot, toParent, (order) =>
    order.includes(path.posix.basename(to)) ? order : [...order, path.posix.basename(to)],
  );
}

export async function reorderChildren(
  modelRoot: string,
  parentRel: string,
  childOrder: string[]
): Promise<void> {
  if (!Array.isArray(childOrder)) {
    throw new ModelFsError("child_order must be an array", 400);
  }
  await patchNodeOrder(modelRoot, parentRel, () => [...childOrder]);
}
