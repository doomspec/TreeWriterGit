import type { MarkdownHeading } from "@/lib/markdownOutline";
import { parentPath, resolveNavigateTarget } from "@/lib/modelTree";

/** Folder path a heading link navigates to (sections / subsections). */
export function resolveHeadingFolderPath(
  linkContextPath: string,
  heading: MarkdownHeading,
): string | null {
  if (!heading.href?.trim() || !linkContextPath) return null;
  const target = resolveNavigateTarget(linkContextPath, heading.href);
  if (!target) return null;
  if (target.type === "file") {
    const folder = parentPath(target.path);
    return folder || null;
  }
  return target.path.replace(/\/$/, "") || null;
}

/** Deepest outline heading whose target contains or equals focusPath. */
export function findActiveOutlineHeadingId(
  headings: MarkdownHeading[],
  linkContextPath: string,
  focusPath: string,
): string | null {
  const normalizedFocus = focusPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalizedFocus || !linkContextPath) return null;

  let best: { id: string; path: string } | null = null;

  for (const heading of headings) {
    const folderPath = resolveHeadingFolderPath(linkContextPath, heading);
    if (!folderPath) continue;
    const normalizedFolder = folderPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (
      normalizedFocus === normalizedFolder ||
      normalizedFocus.startsWith(`${normalizedFolder}/`)
    ) {
      if (!best || normalizedFolder.length > best.path.length) {
        best = { id: heading.id, path: normalizedFolder };
      }
    }
  }

  return best?.id ?? null;
}

export function isOutlineNavLinkActive(
  linkContextPath: string,
  href: string,
  focusPath: string | null | undefined,
): boolean {
  if (!focusPath || !linkContextPath || !href.trim()) return false;
  const target = resolveNavigateTarget(linkContextPath, href);
  if (!target) return false;
  const folderPath =
    target.type === "file" ? parentPath(target.path) : target.path.replace(/\/$/, "");
  if (!folderPath) return false;
  const normalizedFocus = focusPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFolder = folderPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return (
    normalizedFocus === normalizedFolder || normalizedFocus.startsWith(`${normalizedFolder}/`)
  );
}
