import { isOutlineNavLinkActive } from "@/lib/outlineActiveNav";

export function applyOutlineNavLinkHighlight(
  root: HTMLElement,
  linkContextPath: string,
  activePath: string | null | undefined,
): void {
  root.querySelectorAll("a[href]").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    const href = anchor.getAttribute("href");
    if (!href) return;
    anchor.classList.toggle(
      "outline-nav-link--active",
      isOutlineNavLinkActive(linkContextPath, href, activePath),
    );
  });
}
