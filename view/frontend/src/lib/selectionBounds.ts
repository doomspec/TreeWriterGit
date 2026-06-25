export type ViewportBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TEXTAREA_MIRROR_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

function copyTextareaStyles(textarea: HTMLTextAreaElement, mirror: HTMLElement): void {
  const computed = window.getComputedStyle(textarea);
  for (const prop of TEXTAREA_MIRROR_PROPS) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
}

function getTextareaSelectionBounds(textarea: HTMLTextAreaElement): ViewportBounds | null {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  if (start === end) return null;

  const selected = textarea.value.slice(start, end);
  if (!selected.trim()) return null;

  const textareaRect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  document.body.appendChild(mirror);
  copyTextareaStyles(textarea, mirror);
  mirror.style.position = "fixed";
  mirror.style.top = `${textareaRect.top}px`;
  mirror.style.left = `${textareaRect.left}px`;
  mirror.style.width = `${textareaRect.width}px`;
  mirror.style.height = "auto";
  mirror.style.overflow = "hidden";
  mirror.style.visibility = "hidden";
  mirror.style.zIndex = "-1";

  const before = document.createTextNode(textarea.value.slice(0, start));
  const marker = document.createElement("span");
  marker.textContent = selected || ".";
  const after = document.createTextNode(textarea.value.slice(end));
  mirror.append(before, marker, after);

  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  if (markerRect.width === 0 && markerRect.height === 0) return null;

  return {
    top: markerRect.top,
    left: markerRect.left,
    width: markerRect.width,
    height: markerRect.height,
  };
}

function getTextareaCaretBounds(textarea: HTMLTextAreaElement): ViewportBounds | null {
  const pos = textarea.selectionStart ?? 0;
  const textareaRect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  document.body.appendChild(mirror);
  copyTextareaStyles(textarea, mirror);
  mirror.style.position = "fixed";
  mirror.style.top = `${textareaRect.top}px`;
  mirror.style.left = `${textareaRect.left}px`;
  mirror.style.width = `${textareaRect.width}px`;
  mirror.style.height = "auto";
  mirror.style.overflow = "hidden";
  mirror.style.visibility = "hidden";
  mirror.style.zIndex = "-1";

  const before = document.createTextNode(textarea.value.slice(0, pos));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  const after = document.createTextNode(textarea.value.slice(pos));
  mirror.append(before, marker, after);

  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  if (markerRect.width === 0 && markerRect.height === 0) {
    return {
      top: textareaRect.top + 8,
      left: textareaRect.left + 8,
      width: 2,
      height: 18,
    };
  }

  return {
    top: markerRect.top,
    left: markerRect.left,
    width: Math.max(markerRect.width, 2),
    height: markerRect.height || 18,
  };
}

function getDomCaretBounds(scope: HTMLElement): ViewportBounds | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || selection.rangeCount === 0) return null;

  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (
    (anchor == null || !scope.contains(anchor)) &&
    (focus == null || !scope.contains(focus))
  ) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return {
      top: rect.top,
      left: rect.left,
      width: 2,
      height: 18,
    };
  }

  return {
    top: rect.top,
    left: rect.left,
    width: Math.max(rect.width, 2),
    height: rect.height,
  };
}
function getDomSelectionBounds(scope: HTMLElement): ViewportBounds | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return null;
  }

  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (
    (anchor == null || !scope.contains(anchor)) &&
    (focus == null || !scope.contains(focus))
  ) {
    return null;
  }

  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** Viewport coordinates for the active selection or caret inside `scope`. */
export function getSelectionBoundsInScope(scope: HTMLElement | null): ViewportBounds | null {
  if (!scope) return null;

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && scope.contains(active)) {
    return getTextareaSelectionBounds(active) ?? getTextareaCaretBounds(active);
  }

  return getDomSelectionBounds(scope) ?? getDomCaretBounds(scope);
}

export function clampInlineToolbarPosition(
  bounds: ViewportBounds,
  toolbarWidth: number,
  toolbarHeight: number,
  gap = 8,
): { top: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  let top = bounds.top - toolbarHeight - gap;
  if (top < margin) {
    top = bounds.top + bounds.height + gap;
  }
  if (top + toolbarHeight > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - toolbarHeight - margin);
  }

  let left = bounds.left + bounds.width / 2 - toolbarWidth / 2;
  left = Math.max(margin, Math.min(left, viewportWidth - toolbarWidth - margin));

  return { top, left };
}

export type EditorPaneTarget = "preview" | "source";

/** Which editor pane owns the current selection inside `scope`. */
export function getSelectionEditorTarget(
  scope: HTMLElement | null,
  sourceRoot: HTMLElement | null,
  fallback: EditorPaneTarget = "preview",
): EditorPaneTarget {
  if (!scope) return fallback;

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && scope.contains(active)) {
    if (sourceRoot?.contains(active)) return "source";
    return "preview";
  }

  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const focus = selection?.focusNode;
  if (sourceRoot) {
    if (anchor != null && sourceRoot.contains(anchor)) return "source";
    if (focus != null && sourceRoot.contains(focus)) return "source";
  }

  if (anchor != null && scope.contains(anchor)) return "preview";
  if (focus != null && scope.contains(focus)) return "preview";

  return fallback;
}
