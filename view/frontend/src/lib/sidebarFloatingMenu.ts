const OPEN_ATTR = "data-sidebar-floating-menu-open";

/** Mark a portaled sidebar dropdown as open so hover-collapse sidebars stay visible. */
export function registerSidebarFloatingMenuOpen(): () => void {
  if (typeof document === "undefined") return () => {};
  document.body.setAttribute(OPEN_ATTR, "true");
  return () => {
    document.body.removeAttribute(OPEN_ATTR);
  };
}

export function isSidebarFloatingMenuOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.hasAttribute(OPEN_ATTR);
}
