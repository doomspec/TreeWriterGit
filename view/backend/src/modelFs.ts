import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm, stat, readdir } from "node:fs/promises";
import matter from "gray-matter";

export type NodeKind = "section" | "subsection" | "unit";

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
  if (!name || /[\\/]/.test(name) || name === "." || name === ".." || name.startsWith(".")) {
    throw new ModelFsError(`Invalid node name: ${JSON.stringify(name)}`, 400);
  }
}

/** Frontmatter + body skeleton for a freshly created node. */
export function indexSkeleton(name: string, kind: NodeKind): string {
  const title = titleCase(name);
  if (kind === "unit") {
    return matter.stringify(
      `# ${title}\n\nMain idea: _what this paragraph must say, evidence to use, citations to hit._\n`,
      { kind: "unit", title, status: "outline", links: [] }
    );
  }
  return matter.stringify(`# ${title}\n\n_Outline / narrative arc for this ${kind}._\n`, {
    kind,
    title,
    child_order: []
  });
}

const indexPathFor = (parentRel: string): string =>
  parentRel ? `${parentRel}/INDEX.md` : "INDEX.md";

async function patchChildOrder(
  modelRoot: string,
  parentRel: string,
  mutate: (order: string[]) => string[]
): Promise<void> {
  const indexRel = indexPathFor(parentRel);
  const indexAbs = resolveModelPath(modelRoot, indexRel);
  if (!existsSync(indexAbs)) {
    return; // no parent INDEX → nothing to track (e.g. model root)
  }
  // gray-matter caches parsed objects by input string; never mutate parsed.data
  // (a mutated cache entry resurfaces when content cycles back to a seen string).
  const parsed = matter(await readFile(indexAbs, "utf8"));
  const current: string[] = Array.isArray(parsed.data.child_order) ? parsed.data.child_order : [];
  const data = { ...parsed.data, child_order: mutate([...current]) };
  await writeFile(indexAbs, matter.stringify(parsed.content, data), "utf8");
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
  if (kind === "unit") {
    await writeFile(path.join(abs, "draft.md"), "", "utf8");
  }
  await patchChildOrder(modelRoot, parentRel, (order) =>
    order.includes(name) ? order : [...order, name]
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
    const entries = (await readdir(abs)).filter((e) => e !== "INDEX.md" && e !== "draft.md");
    if (entries.length > 0 && !recursive) {
      throw new ModelFsError(`Directory not empty: ${relativePath}`, 409);
    }
    await rm(abs, { recursive: true, force: true });
  } else {
    await rm(abs, { force: true });
  }
  await patchChildOrder(modelRoot, path.posix.dirname(relativePath).replace(/^\.$/, ""), (order) =>
    order.filter((n) => n !== path.posix.basename(relativePath))
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
  await patchChildOrder(modelRoot, fromParent, (order) =>
    order.filter((n) => n !== path.posix.basename(from))
  );
  await patchChildOrder(modelRoot, toParent, (order) =>
    order.includes(path.posix.basename(to)) ? order : [...order, path.posix.basename(to)]
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
  await patchChildOrder(modelRoot, parentRel, () => [...childOrder]);
}
