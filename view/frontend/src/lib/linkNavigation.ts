import { formatChord } from "@/lib/keyboardChords";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

/** Navigate or open a link from an editor surface (block editor, preview, etc.). */
export function navigateFromEditorLink(
  href: string | null | undefined,
  linkContextPath: string,
  onNavigate?: (target: NavigateTarget) => void,
  linksClickable = true,
): boolean {
  if (!href) return false;

  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    window.open(href, "_blank", "noopener,noreferrer");
    return true;
  }

  if (!linksClickable || !onNavigate) return false;

  if (href.startsWith("figure://")) {
    onNavigate({ type: "folder", path: href.slice("figure://".length) });
    return true;
  }

  if (href.startsWith("equation://")) {
    onNavigate({ type: "folder", path: href.slice("equation://".length) });
    return true;
  }

  const target = resolveNavigateTarget(linkContextPath, href);
  if (!target) return false;
  onNavigate(target);
  return true;
}

export function anchorFromEvent(event: React.MouseEvent | MouseEvent): HTMLAnchorElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a");
  if (!anchor) return null;
  return anchor.getAttribute("href") ? anchor : null;
}

/** Plain click selects the link; Cmd/Ctrl or middle-click opens it. */
export function shouldNavigateLinkFromClick(event: React.MouseEvent | MouseEvent): boolean {
  if (event.metaKey || event.ctrlKey) return true;
  if ("button" in event && event.button === 1) return true;
  return false;
}

export function selectLinkElement(anchor: HTMLAnchorElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(anchor);
  selection.removeAllRanges();
  selection.addRange(range);
}

const MOD_CLICK = formatChord("mod+click");

export function editorInternalLinkTitle(resolvedPath?: string | null): string {
  const base = `Click to select · ${MOD_CLICK} to open`;
  if (!resolvedPath?.trim()) return base;
  return `${base} → ${resolvedPath.trim()}`;
}

export function editorExternalLinkTitle(): string {
  return `Click to select · Opens in new tab (${MOD_CLICK})`;
}

export function viewerInternalLinkTitle(): string {
  return "Click to open";
}

export function figureRefBadgeTitle(): string {
  return `${MOD_CLICK} to open figure`;
}

/** Returns true only when navigation occurred (caller should skip caret placement). */
export function handleEditorLinkClick(
  event: React.MouseEvent,
  linkContextPath: string,
  onNavigate?: (target: NavigateTarget) => void,
  linksClickable = true,
  onNavigateFailed?: (href: string) => void,
): boolean {
  const anchor = anchorFromEvent(event);
  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  if (shouldNavigateLinkFromClick(event)) {
    if (!navigateFromEditorLink(href, linkContextPath, onNavigate, linksClickable)) {
      if (href) onNavigateFailed?.(href);
      selectLinkElement(anchor);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  // Plain click: place caret in the link — do not navigate or select the whole link.
  return false;
}
