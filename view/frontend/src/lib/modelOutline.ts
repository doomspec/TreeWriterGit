import type { ModelNode, OutlineItem } from "./modelTreeTypes";
import {
  INDEX_DOC,
  OUTLINE_DOC,
  PAPERS_ROOT,
  isHiddenModelFile,
  outlinePathFor,
} from "./modelPaths";
import { findNode } from "./modelTreeQuery";
import { parseFrontmatterLinks, stripFrontmatter } from "./modelFrontmatter";

export type IndexOutlineLink = {
  label: string;
  href: string;
  targetPath: string | null;
  isFigure?: boolean;
};

/** Resolve a markdown link target relative to the current folder path. */
export function resolveOutlineTarget(folderPath: string, href: string): string | null {
  const clean = href.split("#")[0]?.trim();
  if (!clean || clean.startsWith("http")) return null;

  if (clean.endsWith("/INDEX.md") || clean === "INDEX.md") {
    const dir = clean.replace(/\/?INDEX\.md$/, "");
    if (!dir) return folderPath || null;
    return folderPath ? `${folderPath}/${dir}` : dir;
  }

  if (clean.endsWith("/outline.md") || clean === "outline.md") {
    const dir = clean.replace(/\/?outline\.md$/, "");
    if (!dir) return folderPath || null;
    return folderPath ? `${folderPath}/${dir}` : dir;
  }

  if (clean.endsWith(".md")) {
    if (clean.includes("/")) {
      return folderPath ? `${folderPath}/${clean}` : clean.replace(/^\.\//, "");
    }
    return folderPath ? `${folderPath}/${clean}` : clean;
  }

  const dir = clean.replace(/\/$/, "");
  return folderPath ? `${folderPath}/${dir}` : dir;
}

/** Parse ## Summary from outline.md body. */
export function parseOutlineSummary(markdown: string): string | null {
  const body = stripFrontmatter(markdown);
  const summarySection = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  if (summarySection?.[1]?.trim()) return summarySection[1].trim();
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const statusMatch = fm[1].match(/^summary:\s*["']?([^"'\n]+)["']?\s*$/m);
  return statusMatch?.[1]?.trim() ?? null;
}

export function parseIndexOutline(markdown: string, folderPath: string): IndexOutlineLink[] {
  const body = stripFrontmatter(markdown);
  const outlineMatch = body.match(/##\s+Outline\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  const section = outlineMatch?.[1] ?? body;
  const links: IndexOutlineLink[] = [];
  const seen = new Set<string>();

  const mdLink = /\*\s+\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(section)) !== null) {
    const label = m[1].trim();
    const href = m[2].trim();
    const key = `${label}:${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      label,
      href,
      targetPath: resolveOutlineTarget(folderPath, href),
      isFigure: /notes\/data\//i.test(href) || /\bfig[-_]/i.test(href),
    });
  }

  const wikiLink = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  while ((m = wikiLink.exec(section)) !== null) {
    const target = m[1].trim();
    const href = target;
    const key = `wiki:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      label: target.split("/").pop() ?? target,
      href,
      targetPath: resolveOutlineTarget(folderPath, target),
      isFigure: /notes\/data\//i.test(target) || /\bfig[-_]/i.test(target),
    });
  }

  return links;
}

/** Graph + navigation links from INDEX metadata and outline.md content. */
export function outlineLinkTargets(
  indexMarkdown: string,
  outlineMarkdown: string,
  folderPath: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (target: string | null) => {
    if (!target || seen.has(target)) return;
    seen.add(target);
    out.push(target);
  };
  for (const href of parseFrontmatterLinks(indexMarkdown)) {
    add(resolveOutlineTarget(folderPath, href));
  }
  for (const link of parseIndexOutline(outlineMarkdown || indexMarkdown, folderPath)) {
    add(link.targetPath);
  }
  const body = stripFrontmatter(outlineMarkdown || indexMarkdown);
  const wikiLink = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiLink.exec(body)) !== null) {
    add(resolveOutlineTarget(folderPath, m[1].trim()));
  }
  return out;
}

/** Heuristic: INDEX is stale when composed_at_commit is missing (Phase 4 adds mtime/git checks). */
export function isIndexStale(
  composedAtCommit: string | null,
  latestChildUpdatedAt: string | null = null,
): boolean {
  if (!composedAtCommit || composedAtCommit === "null") return true;
  if (!latestChildUpdatedAt) return false;
  const commitTime = Date.parse(composedAtCommit);
  const childTime = Date.parse(latestChildUpdatedAt);
  if (Number.isNaN(commitTime) || Number.isNaN(childTime)) return false;
  return childTime > commitTime;
}

export function childrenOf(tree: ModelNode[], folderPath: string): ModelNode[] {
  if (!folderPath) return tree;
  return findNode(tree, folderPath)?.children ?? [];
}

export function outlineForParent(tree: ModelNode[], currentParentPath: string): OutlineItem[] {
  const parentNode = currentParentPath ? findNode(tree, currentParentPath) : null;
  const children = currentParentPath ? parentNode?.children ?? [] : tree;
  const parentTitle = currentParentPath ? currentParentPath.split("/").at(-1) ?? "model" : "model";

  return [
    {
      id: `outline:${currentParentPath || "root"}`,
      name: OUTLINE_DOC,
      path: outlinePathFor(currentParentPath),
      kind: "index",
      subtitle: parentTitle,
    },
    ...children
      .filter((child) => child.type === "directory" || child.name.endsWith(".md"))
      .filter((child) => !isHiddenModelFile(child.name) && child.name !== OUTLINE_DOC)
      .map((child) => {
        if (child.type === "directory") {
          return {
            id: `directory:${child.path}`,
            name: child.name,
            path: child.path,
            kind: "directory" as const,
            subtitle: `${child.path}/`,
          };
        }
        return {
          id: `file:${child.path}`,
          name: child.name,
          path: child.path,
          kind: "file" as const,
          subtitle: child.path,
        };
      }),
  ];
}

export function childCardsForFolder(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
): OutlineItem[] {
  const items = outlineForParent(tree, folderPath).filter((i) => i.kind !== "index");
  if (childOrder.length === 0) return items;

  const byName = new Map(items.map((i) => [i.name.replace(/\.md$/, ""), i]));
  const ordered: OutlineItem[] = [];
  for (const name of childOrder) {
    const item = byName.get(name);
    if (item) ordered.push(item);
  }
  for (const item of items) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
}

export function breadcrumbSegments(path: string): { label: string; path: string }[] {
  if (!path) return [{ label: "model", path: "" }];
  const parts = path.split("/").filter(Boolean);
  return [
    { label: "model", path: "" },
    ...parts.map((part, i) => ({
      label: part,
      path: parts.slice(0, i + 1).join("/"),
    })),
  ];
}

/** Breadcrumbs scoped to a paper — omits model/papers prefixes. */
export function papersBreadcrumbSegments(path: string): { label: string; path: string }[] {
  if (!path || path === PAPERS_ROOT || !path.startsWith(`${PAPERS_ROOT}/`)) {
    return [];
  }
  const relative = path.slice(`${PAPERS_ROOT}/`.length);
  const parts = relative.split("/").filter(Boolean);
  return parts.map((part, index) => ({
    label: part,
    path: `${PAPERS_ROOT}/${parts.slice(0, index + 1).join("/")}`,
  }));
}
