export type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: ModelNode[];
};

export type OutlineItem = {
  id: string;
  name: string;
  path: string;
  kind: "index" | "directory" | "file";
  subtitle: string;
};

export function parentPath(pathValue: string): string {
  const parts = pathValue.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export const INDEX_DOC = "INDEX.md";
export const OUTLINE_DOC = "outline.md";
export const DRAFT_DOC = "draft.md";

/** Technical metadata file — hidden from the UI. */
export function indexPathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${INDEX_DOC}` : INDEX_DOC;
}

/** User-facing section overview (authors and readers). */
export function outlinePathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${OUTLINE_DOC}` : OUTLINE_DOC;
}

export function draftPathFor(directoryPath: string): string {
  return directoryPath ? `${directoryPath}/${DRAFT_DOC}` : DRAFT_DOC;
}

export function isHiddenModelFile(fileName: string): boolean {
  return fileName === INDEX_DOC;
}

export function isOutlineDocPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${OUTLINE_DOC}`) || pathValue === OUTLINE_DOC;
}

export function isDraftPath(pathValue: string): boolean {
  return pathValue.endsWith(`/${DRAFT_DOC}`);
}

/** @deprecated use isHiddenModelFile */
export function isOutlinePath(pathValue: string): boolean {
  return pathValue === INDEX_DOC || pathValue.endsWith(`/${INDEX_DOC}`);
}

export function displayFileLabel(fileName: string): string | null {
  if (fileName === INDEX_DOC) return null;
  if (fileName === OUTLINE_DOC) return "Outline";
  if (fileName === DRAFT_DOC) return "Draft";
  return fileName;
}

/** Explorer tree order: outline before draft; INDEX hidden. */
export function sortTreeChildren(nodes: ModelNode[]): ModelNode[] {
  const rank = (name: string): number => {
    if (name === OUTLINE_DOC) return 0;
    if (name === DRAFT_DOC) return 1;
    if (name === INDEX_DOC) return 99;
    return 2;
  };
  return [...nodes].sort((a, b) => {
    const ra = rank(a.name);
    const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export function transformTreeForDisplay(nodes: ModelNode[]): ModelNode[] {
  return sortTreeChildren(nodes)
    .filter((node) => !(node.type === "file" && isHiddenModelFile(node.name)))
    .map((node) =>
      node.type === "directory" && node.children
        ? { ...node, children: transformTreeForDisplay(node.children) }
        : node,
    );
}

export function findNode(nodes: ModelNode[], pathValue: string): ModelNode | null {
  for (const node of nodes) {
    if (node.path === pathValue) return node;
    const child = node.children ? findNode(node.children, pathValue) : null;
    if (child) return child;
  }
  return null;
}

export type NavigateTarget =
  | { type: "folder"; path: string }
  | { type: "file"; path: string };

/** Map graph ids / wikilink paths to a folder or standalone .md file in the tree. */
export function resolveModelPathTarget(
  tree: ModelNode[],
  pathValue: string,
): NavigateTarget | null {
  if (!pathValue) return { type: "folder", path: "" };

  const direct = findNode(tree, pathValue);
  if (direct?.type === "file") {
    return { type: "file", path: pathValue };
  }
  if (direct?.type === "directory") {
    return { type: "folder", path: pathValue };
  }

  const mdCandidate = pathValue.endsWith(".md") ? pathValue : `${pathValue}.md`;
  const fileNode = findNode(tree, mdCandidate);
  if (fileNode?.type === "file") {
    return { type: "file", path: mdCandidate };
  }

  const base = pathValue.split("/").pop() ?? "";
  const parent = parentPath(pathValue);
  const parentNode = findNode(tree, parent);
  const sibling = parentNode?.children?.find(
    (c) => c.type === "file" && c.name.replace(/\.md$/i, "") === base,
  );
  if (sibling) {
    return { type: "file", path: sibling.path };
  }

  return null;
}

export function flattenFiles(nodes: ModelNode[]): ModelNode[] {
  return nodes.flatMap((node) => (node.type === "file" ? [node] : flattenFiles(node.children ?? [])));
}

export const PAPERS_ROOT = "papers";

/** True for `papers/{slug}` — the paper root folder (not a nested section). */
export function isPaperRootPath(pathValue: string): boolean {
  return /^papers\/[^/]+$/.test(pathValue.trim().replace(/\\/g, "/"));
}

/** Folder with outline.md (and optionally draft.md) — editable outline + draft pair. */
export function isUnitFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  const hasOutlineDraft = node.children.some(
    (c) => c.type === "file" && (c.name === OUTLINE_DOC || c.name === DRAFT_DOC),
  );
  if (!hasOutlineDraft) return false;
  if (isTableFolder(node)) return false;
  const hasFigureAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return !hasFigureAsset;
}

/** Table leaf folder under tables/ with outline + draft (no figure asset). */
export function isTableFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  if (!node.path.includes("/tables/")) return false;
  const hasOutline = node.children.some((c) => c.type === "file" && c.name === OUTLINE_DOC);
  const hasDraft = node.children.some((c) => c.type === "file" && c.name === DRAFT_DOC);
  const hasFigureAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return hasOutline && hasDraft && !hasFigureAsset;
}

/** Figure leaf folder: outline + draft + image/mermaid asset. */
export function isFigureFolder(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  if (node.children.some((c) => c.type === "directory")) return false;
  const hasOutline = node.children.some((c) => c.type === "file" && c.name === OUTLINE_DOC);
  const hasDraft = node.children.some((c) => c.type === "file" && c.name === DRAFT_DOC);
  const hasAsset = node.children.some(
    (c) =>
      c.type === "file" &&
      /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(c.name),
  );
  return hasOutline && hasDraft && hasAsset;
}

export function isLeafEditorFolder(node: ModelNode | null): boolean {
  return isUnitFolder(node) || isFigureFolder(node) || isTableFolder(node);
}

/** Section container: has child folders (paper, section, subsection). */
export function isSectionContainer(node: ModelNode | null): boolean {
  if (!node?.children) return false;
  return node.children.some((c) => c.type === "directory");
}

/** Resolve href to in-app navigation target. */
export function resolveNavigateTarget(folderPath: string, href: string): NavigateTarget | null {
  const resolved = resolveOutlineTarget(folderPath, href);
  if (!resolved) return null;
  if (
    resolved.endsWith(".md") &&
    !resolved.endsWith(`/${INDEX_DOC}`) &&
    !resolved.endsWith(`/${OUTLINE_DOC}`)
  ) {
    return { type: "file", path: resolved };
  }
  const folder = resolved
    .replace(/\/?INDEX\.md$/, "")
    .replace(/\/outline\.md$/, "");
  return { type: "folder", path: folder };
}

export const FIGURE_LINK_PREFIX = "figure://";
export const ASSET_LINK_PREFIX = "asset://";
export const FIGURE_BLOCK_LANG = "treewriter-figure";

/** Preprocess figure embeds and wikilinks before markdown parse. */
export function preprocessFigureEmbeds(markdown: string): string {
  let result = markdown;

  result = result.replace(/::figure\[([^\]]+)\]/g, (_match, target: string) => {
    return `\n\n\`\`\`${FIGURE_BLOCK_LANG}\n${target.trim()}\n\`\`\`\n\n`;
  });

  result = result.replace(
    /!\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) => {
      const alt = alias?.trim() || target.split("/").pop() || "figure";
      return `\n\n![${alt}](${ASSET_LINK_PREFIX}${target.trim()})\n\n`;
    },
  );

  result = result.replace(
    /(?<!!)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) => {
      const label = alias?.trim() || target.split("/").pop() || target;
      const trimmed = target.trim().replace(/\/INDEX\.md$/i, "");
      const isAsset = /\.(png|jpe?g|svg|mmd|gif|webp)$/i.test(trimmed);
      if (isAsset) {
        return `\n\n![${label}](${ASSET_LINK_PREFIX}${trimmed})\n\n`;
      }
      const isFigureCandidate =
        !trimmed.endsWith(".md") || trimmed.includes("/notes/data/");
      if (isFigureCandidate) {
        const figurePath = trimmed.replace(/\.md$/, "");
        return `[${label}](${FIGURE_LINK_PREFIX}${figurePath})`;
      }
      return `[${label}](${trimmed})`;
    },
  );

  return result;
}

/** Convert remaining wikilinks to markdown links for ReactMarkdown rendering. */
export function preprocessMarkdownLinks(markdown: string): string {
  return preprocessFigureEmbeds(markdown);
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

export function filterTree(nodes: ModelNode[], query: string): ModelNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function walk(node: ModelNode): ModelNode | null {
    const nameMatch = node.name.toLowerCase().includes(q);
    const pathMatch = node.path.toLowerCase().includes(q);
    if (node.type === "file") {
      return nameMatch || pathMatch ? node : null;
    }
    const filteredChildren = (node.children ?? [])
      .map(walk)
      .filter((n): n is ModelNode => n !== null);
    if (nameMatch || pathMatch || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  return nodes.map(walk).filter((n): n is ModelNode => n !== null);
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

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function parseFrontmatterStatus(markdown: string): string | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const statusMatch = match[1].match(/^status:\s*["']?([^"'\n]+)["']?\s*$/m);
  return statusMatch?.[1]?.trim() ?? null;
}

export type IndexMeta = {
  title: string | null;
  summary: string | null;
  composedAtCommit: string | null;
  childOrder: string[];
  kind: string | null;
};

export type IndexOutlineLink = {
  label: string;
  href: string;
  targetPath: string | null;
  isFigure?: boolean;
};

function parseFrontmatterBlock(markdown: string): Record<string, string> | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (kv) {
      data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return data;
}

function parseYamlList(markdown: string, key: string): string[] {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const lines = fm[1].split("\n");
  const items: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(new RegExp(`^${key}:\\s*$`))) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/);
      if (item) {
        items.push(item[1].trim());
        continue;
      }
      if (line.match(/^\S/)) break;
    }
  }
  return items;
}

export function parseIndexFrontmatter(markdown: string): IndexMeta {
  const fm = parseFrontmatterBlock(markdown);
  const body = stripFrontmatter(markdown);
  const headingMatch = body.match(/^\s*#(?!#)\s+(.+?)\s*(?:\r?\n|$)/);

  return {
    title: fm?.title ?? headingMatch?.[1]?.trim() ?? null,
    summary: fm?.summary ?? null,
    composedAtCommit: fm?.composed_at_commit ?? null,
    childOrder: parseYamlList(markdown, "child_order").length
      ? parseYamlList(markdown, "child_order")
      : parseYamlList(markdown, "section_order"),
    kind: fm?.kind ?? null,
  };
}

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

/** Plain paths from frontmatter `links:` (roboculture-style cross-references). */
export function parseFrontmatterLinks(markdown: string): string[] {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [];
  const lines = fm[1].split("\n");
  const items: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(/^links:\s*$/)) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s+-\s+["']?([^"'\n]+)["']?\s*$/);
      if (item) {
        items.push(item[1].trim());
        continue;
      }
      if (line.match(/^\S/)) break;
    }
  }
  return items;
}

/** Parse ## Summary from outline.md body. */
export function parseOutlineSummary(markdown: string): string | null {
  const body = stripFrontmatter(markdown);
  const summarySection = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\n#[^#]|$)/i);
  if (summarySection?.[1]?.trim()) return summarySection[1].trim();
  const fm = parseFrontmatterBlock(markdown);
  return fm?.summary ?? null;
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

export type PaperSectionItem = {
  name: string;
  path: string;
  title: string;
};

const PAPER_SKIP_FOLDERS = new Set(["notes", ".sessions", ".trash", "figures", "tables"]);

function orderedDirectoryChildren(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
): PaperSectionItem[] {
  const children = childrenOf(tree, folderPath).filter(
    (c) => c.type === "directory" && !PAPER_SKIP_FOLDERS.has(c.name),
  );
  const byName = new Map(children.map((c) => [c.name, c]));
  const ordered: PaperSectionItem[] = [];
  for (const name of childOrder) {
    if (PAPER_SKIP_FOLDERS.has(name)) continue;
    const node = byName.get(name);
    if (node) {
      ordered.push({ name, path: node.path, title: titleFromFolderName(name) });
    }
  }
  for (const node of children) {
    if (!ordered.some((s) => s.name === node.name)) {
      ordered.push({ name: node.name, path: node.path, title: titleFromFolderName(node.name) });
    }
  }
  return ordered;
}

function titleFromFolderName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Ordered child folders (subsections, units) under any paper folder. */
export function orderedChildFolders(
  tree: ModelNode[],
  folderPath: string,
  childOrder: string[],
): PaperSectionItem[] {
  return orderedDirectoryChildren(tree, folderPath, childOrder);
}

/** All folder paths under a paper (paper root + nested section/unit dirs). */
export function collectPaperFolderPaths(tree: ModelNode[], paperPath: string): string[] {
  const paths: string[] = [paperPath];
  const walk = (folderPath: string) => {
    for (const child of childrenOf(tree, folderPath)) {
      if (child.type !== "directory") continue;
      paths.push(child.path);
      walk(child.path);
    }
  };
  walk(paperPath);
  return paths;
}

/** Ordered top-level sections for a paper folder. */
export function sectionsForPaper(
  tree: ModelNode[],
  paperPath: string,
  sectionOrder: string[],
): PaperSectionItem[] {
  return orderedDirectoryChildren(tree, paperPath, sectionOrder);
}
