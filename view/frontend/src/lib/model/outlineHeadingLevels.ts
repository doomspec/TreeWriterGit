import { resolveOutlineTarget } from "../modelOutline";
import { findNode, folderNodeKind } from "./modelTree";
import type { MarkdownHeading } from "../markdownOutline";
import type { ModelNode } from "./modelTreeTypes";

function isOutlineContainerKind(kind: string | null): boolean {
  return kind === "paper" || kind === "section" || kind === "subsection";
}

function resolveHeadingFolderPath(
  tree: ModelNode[],
  rootPath: string,
  containerPath: string,
  href: string,
): string | null {
  const fromContainer = resolveOutlineTarget(containerPath, href);
  if (fromContainer && findNode(tree, fromContainer)) return fromContainer;

  const fromRoot = resolveOutlineTarget(rootPath, href);
  if (fromRoot && findNode(tree, fromRoot)) return fromRoot;

  return fromContainer ?? fromRoot;
}

function depthFromRoot(rootPath: string, folderPath: string): number {
  const root = rootPath.replace(/\/+$/, "");
  const folder = folderPath.replace(/\/+$/, "");
  if (folder === root) return 0;
  if (!folder.startsWith(`${root}/`)) return 0;
  return folder.slice(root.length + 1).split("/").filter(Boolean).length;
}

/** Align sidebar outline levels with model folder nesting (subsection > unit). */
export function applyOutlineHeadingLevelsFromModel(
  headings: MarkdownHeading[],
  tree: ModelNode[],
  linkContextPath: string,
): MarkdownHeading[] {
  const rootPath = linkContextPath.replace(/\/+$/, "");
  if (!rootPath || headings.length === 0) return headings;

  const titleLevel = headings.find((heading) => heading.level === 1)?.level ?? 1;
  let containerPath = rootPath;

  return headings.map((heading) => {
    if (!heading.href) return heading;

    const folderPath = resolveHeadingFolderPath(tree, rootPath, containerPath, heading.href);
    if (!folderPath) return heading;

    const node = findNode(tree, folderPath);
    const kind = folderNodeKind(node);
    if (isOutlineContainerKind(kind)) {
      containerPath = folderPath;
    }

    const modelLevel = titleLevel + depthFromRoot(rootPath, folderPath);
    return { ...heading, level: Math.max(heading.level, modelLevel) };
  });
}
