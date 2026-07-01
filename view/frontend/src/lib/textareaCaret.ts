/** Approximate viewport coordinates for a caret index inside a textarea. */
export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  const properties = [
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
    "whiteSpace",
  ] as const;

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = style.whiteSpace === "normal" ? "pre-wrap" : style.whiteSpace;
  div.style.wordWrap = "break-word";
  for (const property of properties) {
    div.style[property] = style[property];
  }

  const text = textarea.value.substring(0, position);
  div.textContent = text;
  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);
  document.body.appendChild(div);

  const textareaRect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || spanRect.height || 16;

  document.body.removeChild(div);

  const left = textareaRect.left + (spanRect.left - divRect.left) - textarea.scrollLeft;
  const top =
    textareaRect.top + (spanRect.top - divRect.top) - textarea.scrollTop + lineHeight + 4;

  return { top, left, height: lineHeight };
}

function mirrorDivForTextarea(textarea: HTMLTextAreaElement): HTMLDivElement {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  const properties = [
    "direction",
    "boxSizing",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
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
    "whiteSpace",
  ] as const;

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.whiteSpace = style.whiteSpace === "normal" ? "pre-wrap" : style.whiteSpace;
  div.style.wordWrap = "break-word";
  div.style.width = `${textarea.clientWidth}px`;
  for (const property of properties) {
    div.style[property] = style[property];
  }
  return div;
}

/** Scroll a textarea so the caret at `position` is visible (handles soft-wrapped lines). */
export function scrollTextareaCaretIntoView(
  textarea: HTMLTextAreaElement,
  position: number,
  options: { margin?: number } = {},
): void {
  const margin = options.margin ?? 48;
  const div = mirrorDivForTextarea(textarea);
  const text = textarea.value.substring(0, position);
  div.textContent = text;
  const marker = document.createElement("span");
  marker.textContent = textarea.value.substring(position) || ".";
  div.appendChild(marker);
  document.body.appendChild(div);

  const style = window.getComputedStyle(textarea);
  const caretTop = marker.offsetTop;
  const caretHeight = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 16;
  document.body.removeChild(div);

  const visibleTop = textarea.scrollTop;
  const visibleBottom = visibleTop + textarea.clientHeight;

  if (caretTop < visibleTop + margin) {
    textarea.scrollTop = Math.max(0, caretTop - margin);
  } else if (caretTop + caretHeight > visibleBottom - margin) {
    textarea.scrollTop = Math.max(0, caretTop + caretHeight - textarea.clientHeight + margin);
  }
}

export function syncTextareaMirrorScroll(textarea: HTMLTextAreaElement): void {
  const mirror = textarea.parentElement?.querySelector("pre");
  if (mirror instanceof HTMLElement) {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }
}
