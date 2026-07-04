import type { DocxImportPreviewNode } from "@treewriter/shared";

export function slugFromImportTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "item";
}

function uniqueImportSlug(base: string, used: Set<string>): string {
  const root = slugFromImportTitle(base);
  let candidate = root;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function countImportPlan(nodes: DocxImportPreviewNode[]): {
  sectionsCreated: number;
  unitsCreated: number;
} {
  let sectionsCreated = 0;
  let unitsCreated = 0;
  for (const node of nodes) {
    if (node.kind === "unit") {
      unitsCreated += 1;
      continue;
    }
    sectionsCreated += 1;
    if (node.children?.length) {
      const nested = countImportPlan(node.children);
      sectionsCreated += nested.sectionsCreated;
      unitsCreated += nested.unitsCreated;
    }
  }
  return { sectionsCreated, unitsCreated };
}

export function recomputeImportPlanSlugs(nodes: DocxImportPreviewNode[]): DocxImportPreviewNode[] {
  const used = new Set<string>();
  return nodes.map((node) => recomputeNodeSlugs(node, used));
}

function recomputeNodeSlugs(
  node: DocxImportPreviewNode,
  used: Set<string>,
): DocxImportPreviewNode {
  const slug = uniqueImportSlug(node.title, used);
  if (node.kind === "unit") {
    return { ...node, slug };
  }
  const childUsed = new Set<string>();
  const children = node.children?.map((child) => recomputeNodeSlugs(child, childUsed));
  return {
    ...node,
    slug,
    children: children?.length ? children : undefined,
  };
}

function updateChildrenAtPath(
  nodes: DocxImportPreviewNode[],
  parentPath: number[],
  updater: (children: DocxImportPreviewNode[]) => DocxImportPreviewNode[],
): DocxImportPreviewNode[] {
  if (parentPath.length === 0) {
    return updater(nodes);
  }
  const [head, ...rest] = parentPath;
  return nodes.map((node, index) => {
    if (index !== head) return node;
    const children = node.children ?? [];
    return {
      ...node,
      children: updateChildrenAtPath(children, rest, updater),
    };
  });
}

export function reorderImportPlanNode(
  nodes: DocxImportPreviewNode[],
  parentPath: number[],
  fromIndex: number,
  toIndex: number,
): DocxImportPreviewNode[] {
  if (fromIndex === toIndex) return nodes;
  return updateChildrenAtPath(nodes, parentPath, (children) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= children.length || toIndex >= children.length) {
      return children;
    }
    const next = [...children];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
}

export function deleteImportPlanNode(
  nodes: DocxImportPreviewNode[],
  path: number[],
): DocxImportPreviewNode[] {
  if (path.length === 0) return nodes;
  if (path.length === 1) {
    return nodes.filter((_, index) => index !== path[0]);
  }
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateChildrenAtPath(nodes, parentPath, (children) =>
    children.filter((_, childIndex) => childIndex !== index),
  );
}

export function mergeImportPlanUnits(
  nodes: DocxImportPreviewNode[],
  path: number[],
): DocxImportPreviewNode[] {
  if (path.length === 0) return nodes;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateChildrenAtPath(nodes, parentPath, (children) => {
    const current = children[index];
    const next = children[index + 1];
    if (!current || !next || current.kind !== "unit" || next.kind !== "unit") {
      return children;
    }
    const mergedBody = [current.body ?? current.title, next.body ?? next.title]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n");
    const merged: DocxImportPreviewNode = {
      ...current,
      body: mergedBody,
    };
    const result = [...children];
    result.splice(index, 2, merged);
    return recomputeImportPlanSlugs(result);
  });
}

export function addImportPlanContainer(
  nodes: DocxImportPreviewNode[],
  parentPath: number[] | null,
  kind: "section" | "subsection",
  title: string,
): DocxImportPreviewNode[] {
  const trimmed = title.trim();
  if (!trimmed) return nodes;
  const child: DocxImportPreviewNode = {
    title: trimmed,
    slug: slugFromImportTitle(trimmed),
    kind,
  };
  return updateChildrenAtPath(nodes, parentPath ?? [], (children) => {
    const next = [...children, child];
    return recomputeImportPlanSlugs(next);
  });
}

export function addImportPlanUnit(
  nodes: DocxImportPreviewNode[],
  parentPath: number[],
  title: string,
  body = "",
): DocxImportPreviewNode[] {
  const trimmed = title.trim();
  if (!trimmed) return nodes;
  const child: DocxImportPreviewNode = {
    title: trimmed,
    slug: slugFromImportTitle(trimmed),
    kind: "unit",
    body: body.trim() || trimmed,
  };
  return updateChildrenAtPath(nodes, parentPath, (children) => {
    const next = [...children, child];
    return recomputeImportPlanSlugs(next);
  });
}

export function cloneImportPlan(nodes: DocxImportPreviewNode[]): DocxImportPreviewNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? cloneImportPlan(node.children) : undefined,
  }));
}

export function getImportPlanNode(
  nodes: DocxImportPreviewNode[],
  path: number[],
): DocxImportPreviewNode | null {
  let list = nodes;
  let node: DocxImportPreviewNode | null = null;
  for (const index of path) {
    node = list[index] ?? null;
    if (!node) return null;
    list = node.children ?? [];
  }
  return node;
}

function pathKey(path: number[]): string {
  return path.join(".");
}

function isAncestorPath(ancestor: number[], descendant: number[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let index = 0; index < ancestor.length; index += 1) {
    if (ancestor[index] !== descendant[index]) return false;
  }
  return true;
}

function adjustPathAfterRemoval(path: number[], removedPath: number[]): number[] {
  const parentLen = removedPath.length - 1;
  if (path.length <= parentLen) return path;
  if (pathKey(path.slice(0, parentLen)) !== pathKey(removedPath.slice(0, parentLen))) {
    return path;
  }
  const removedIndex = removedPath[removedPath.length - 1] ?? 0;
  if (removedIndex < (path[parentLen] ?? 0)) {
    const next = [...path];
    next[parentLen] = (path[parentLen] ?? 0) - 1;
    return next;
  }
  return path;
}

function adjustIndexAfterRemoval(
  parentPath: number[],
  index: number,
  removedPath: number[],
): number {
  const removedParent = removedPath.slice(0, -1);
  if (pathKey(parentPath) !== pathKey(removedParent)) return index;
  const removedIndex = removedPath[removedPath.length - 1] ?? 0;
  return removedIndex < index ? index - 1 : index;
}

function canAcceptImportPlanChild(
  nodes: DocxImportPreviewNode[],
  parentPath: number[],
  child: DocxImportPreviewNode,
): boolean {
  if (child.kind === "unit") {
    if (parentPath.length === 0) return false;
    const parent = getImportPlanNode(nodes, parentPath);
    return parent !== null && parent.kind !== "unit";
  }
  if (child.kind === "subsection") {
    if (parentPath.length === 0) return false;
    const parent = getImportPlanNode(nodes, parentPath);
    return parent !== null && parent.kind === "section";
  }
  return parentPath.length === 0;
}

function insertImportPlanNode(
  nodes: DocxImportPreviewNode[],
  parentPath: number[],
  index: number,
  node: DocxImportPreviewNode,
): DocxImportPreviewNode[] {
  return updateChildrenAtPath(nodes, parentPath, (children) => {
    const next = [...children];
    const clamped = Math.max(0, Math.min(index, next.length));
    next.splice(clamped, 0, node);
    return next;
  });
}

/** Move a unit or subsection within or between section containers. */
export function moveImportPlanNode(
  nodes: DocxImportPreviewNode[],
  fromPath: number[],
  toPath: number[],
): DocxImportPreviewNode[] {
  if (pathKey(fromPath) === pathKey(toPath)) return nodes;

  const moved = getImportPlanNode(nodes, fromPath);
  const target = getImportPlanNode(nodes, toPath);
  if (!moved || !target) return nodes;
  if (isAncestorPath(fromPath, toPath)) return nodes;

  let destParentPath: number[];
  let destIndex: number;

  if (target.kind !== "unit" && moved.kind !== "section") {
    destParentPath = toPath;
    destIndex = (target.children ?? []).length;
  } else {
    destParentPath = toPath.slice(0, -1);
    destIndex = toPath[toPath.length - 1] ?? 0;
  }

  if (moved.kind === "section" && destParentPath.length > 0) return nodes;
  if (!canAcceptImportPlanChild(nodes, destParentPath, moved)) return nodes;

  const without = deleteImportPlanNode(nodes, fromPath);
  const adjustedParent = adjustPathAfterRemoval(destParentPath, fromPath);
  const adjustedIndex = adjustIndexAfterRemoval(destParentPath, destIndex, fromPath);
  const inserted = insertImportPlanNode(without, adjustedParent, adjustedIndex, moved);
  return recomputeImportPlanSlugs(inserted);
}

export function canMoveImportPlanNode(
  nodes: DocxImportPreviewNode[],
  fromPath: number[],
  toPath: number[],
): boolean {
  if (pathKey(fromPath) === pathKey(toPath)) return false;
  const moved = getImportPlanNode(nodes, fromPath);
  const target = getImportPlanNode(nodes, toPath);
  if (!moved || !target) return false;
  if (isAncestorPath(fromPath, toPath)) return false;

  let destParentPath: number[];
  if (target.kind !== "unit" && moved.kind !== "section") {
    destParentPath = toPath;
  } else {
    destParentPath = toPath.slice(0, -1);
  }

  if (moved.kind === "section" && destParentPath.length > 0) return false;
  return canAcceptImportPlanChild(nodes, destParentPath, moved);
}
