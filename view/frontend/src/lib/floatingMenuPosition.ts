const FLOATING_MENU_HEADER_SELECTORS = [".app-chrome-header", ".sidebar-panel-header"] as const;

/** Lowest Y (px) a fixed dropdown may use so it stays below chrome headers. */
export function getFloatingMenuMinTop(padding = 4): number {
  let minTop = padding;
  for (const selector of FLOATING_MENU_HEADER_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.height > 0) {
        minTop = Math.max(minTop, rect.bottom + padding);
      }
    }
  }
  return minTop;
}

/** Place a fixed menu near an anchor, flipping above when needed and avoiding headers. */
export function computeFloatingMenuTop(
  anchorRect: DOMRect,
  menuHeight: number,
  padding = 4,
): number {
  const minTop = getFloatingMenuMinTop(padding);
  const maxBottom = window.innerHeight - padding;

  let top = anchorRect.bottom + padding;
  if (top + menuHeight > maxBottom) {
    top = anchorRect.top - menuHeight - padding;
  }

  top = Math.max(top, minTop);
  if (top + menuHeight > maxBottom) {
    top = Math.max(minTop, maxBottom - menuHeight);
  }
  return top;
}
