/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import {
  clampInlineToolbarPosition,
  getSelectionBoundsInScope,
  getSelectionEditorTarget,
} from "@/lib/selectionBounds";

describe("getSelectionBoundsInScope", () => {
  it("returns bounds for DOM selection inside scope", () => {
    const scope = document.createElement("div");
    scope.innerHTML = "<p>Hello world</p>";
    document.body.appendChild(scope);

    const text = scope.querySelector("p")!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const rect = {
      top: 48,
      left: 24,
      width: 42,
      height: 18,
      right: 66,
      bottom: 66,
      x: 24,
      y: 48,
      toJSON: () => ({}),
    };
    range.getClientRects = () => [rect] as unknown as DOMRectList;

    const bounds = getSelectionBoundsInScope(scope);
    expect(bounds).toEqual({
      top: 48,
      left: 24,
      width: 42,
      height: 18,
    });

    window.getSelection()?.removeAllRanges();
    scope.remove();
  });

  it("returns bounds for textarea selection inside scope", () => {
    const scope = document.createElement("div");
    const textarea = document.createElement("textarea");
    textarea.value = "Hello world";
    scope.appendChild(textarea);
    document.body.appendChild(scope);

    const textareaRect = {
      top: 80,
      left: 16,
      width: 320,
      height: 120,
      right: 336,
      bottom: 200,
      x: 16,
      y: 80,
      toJSON: () => ({}),
    };
    textarea.getBoundingClientRect = () => textareaRect as DOMRect;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "span") {
        element.getBoundingClientRect = () =>
          ({
            top: 96,
            left: 32,
            width: 36,
            height: 18,
            right: 68,
            bottom: 114,
            x: 32,
            y: 96,
            toJSON: () => ({}),
          }) as DOMRect;
      }
      return element;
    });

    textarea.focus();
    textarea.setSelectionRange(0, 5);

    const bounds = getSelectionBoundsInScope(scope);
    expect(bounds).toEqual({
      top: 96,
      left: 32,
      width: 36,
      height: 18,
    });

    vi.restoreAllMocks();
    scope.remove();
  });

  it("returns null when nothing is focused in scope", () => {
    const scope = document.createElement("div");
    scope.textContent = "Hello";
    document.body.appendChild(scope);

    expect(getSelectionBoundsInScope(scope)).toBeNull();

    scope.remove();
  });

  it("returns caret bounds for a focused textarea", () => {
    const scope = document.createElement("div");
    const textarea = document.createElement("textarea");
    textarea.value = "Hello world";
    scope.appendChild(textarea);
    document.body.appendChild(scope);

    const textareaRect = {
      top: 80,
      left: 16,
      width: 320,
      height: 120,
      right: 336,
      bottom: 200,
      x: 16,
      y: 80,
      toJSON: () => ({}),
    };
    textarea.getBoundingClientRect = () => textareaRect as DOMRect;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "span") {
        element.getBoundingClientRect = () =>
          ({
            top: 96,
            left: 40,
            width: 2,
            height: 18,
            right: 42,
            bottom: 114,
            x: 40,
            y: 96,
            toJSON: () => ({}),
          }) as DOMRect;
      }
      return element;
    });

    textarea.focus();
    textarea.setSelectionRange(3, 3);

    const bounds = getSelectionBoundsInScope(scope);
    expect(bounds).toEqual({
      top: 96,
      left: 40,
      width: 2,
      height: 18,
    });

    vi.restoreAllMocks();
    scope.remove();
  });
});

describe("clampInlineToolbarPosition", () => {
  it("places the toolbar above the selection when there is room", () => {
    const position = clampInlineToolbarPosition(
      { top: 200, left: 100, width: 80, height: 20 },
      240,
      36,
    );
    expect(position.top).toBeLessThan(200);
    expect(position.left).toBeGreaterThanOrEqual(8);
  });
});

describe("getSelectionEditorTarget", () => {
  it("returns source when textarea selection is in the source pane", () => {
    const scope = document.createElement("div");
    const sourceRoot = document.createElement("div");
    const textarea = document.createElement("textarea");
    sourceRoot.appendChild(textarea);
    scope.append(sourceRoot);
    document.body.appendChild(scope);

    textarea.focus();
    textarea.setSelectionRange(0, 3);

    expect(getSelectionEditorTarget(scope, sourceRoot)).toBe("source");

    scope.remove();
  });

  it("returns preview for DOM selection outside the source pane", () => {
    const scope = document.createElement("div");
    const sourceRoot = document.createElement("div");
    const preview = document.createElement("div");
    preview.textContent = "Preview text";
    scope.append(sourceRoot, preview);
    document.body.appendChild(scope);

    const text = preview.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 7);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(getSelectionEditorTarget(scope, sourceRoot)).toBe("preview");

    window.getSelection()?.removeAllRanges();
    scope.remove();
  });
});
