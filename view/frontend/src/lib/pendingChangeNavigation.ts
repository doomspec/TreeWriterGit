import { findScrollableParent, scrollElementIntoScrollParent } from "@/lib/documentOutline";

export const PENDING_CHANGE_FOCUS_CLASS = "pending-change-focus";

const PENDING_INSERT_SELECTOR = "mark.highlight-inline--pending, span.highlight-line--pending";
const PENDING_DELETE_SELECTOR = "del.highlight-inline--deleted";

function isDocumentOrderBefore(a: HTMLElement, b: HTMLElement): boolean {
  const position = a.compareDocumentPosition(b);
  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Collect track-change DOM targets in reading order (inserts + pure deletions). */
export function collectPendingChangeElements(root: ParentNode): HTMLElement[] {
  const inserts = Array.from(root.querySelectorAll<HTMLElement>(PENDING_INSERT_SELECTOR));
  const deletes = Array.from(root.querySelectorAll<HTMLElement>(PENDING_DELETE_SELECTOR)).filter(
    (del) => {
      const next = del.nextElementSibling;
      return !(next instanceof HTMLElement && next.matches("mark.highlight-inline--pending"));
    },
  );

  return [...inserts, ...deletes].sort((a, b) => {
    if (a === b) return 0;
    return isDocumentOrderBefore(a, b) ? -1 : 1;
  });
}

export function clearPendingChangeFocus(root: ParentNode | null): void {
  if (!root) return;
  for (const element of root.querySelectorAll<HTMLElement>(`.${PENDING_CHANGE_FOCUS_CLASS}`)) {
    element.classList.remove(PENDING_CHANGE_FOCUS_CLASS);
  }
}

export function scrollToPendingChangeElement(
  element: HTMLElement,
  scrollRoot?: HTMLElement | null,
): void {
  const scrollParent =
    findScrollableParent(element) ?? scrollRoot ?? element.parentElement ?? undefined;
  if (scrollParent) {
    scrollElementIntoScrollParent(element, scrollParent);
    return;
  }
  element.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function focusPendingChangeElement(
  element: HTMLElement,
  scrollRoot?: HTMLElement | null,
): void {
  element.classList.add(PENDING_CHANGE_FOCUS_CLASS);
  scrollToPendingChangeElement(element, scrollRoot);
}
