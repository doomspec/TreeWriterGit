/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  hasOpenInlineEditorPopover,
  isInlineEditorToolbarTarget,
  selectionVisibleInScope,
  useSelectionInScope,
} from "@/lib/readingFocus";

describe("useSelectionInScope", () => {
  it("reveals the bar only after pointer up, not while selecting", () => {
    const scope = document.createElement("div");
    scope.textContent = "Hello world";
    document.body.appendChild(scope);
    const scopeRef = { current: scope };

    const { result } = renderHook(() => useSelectionInScope(scopeRef, true));
    expect(result.current).toBe(false);

    act(() => {
      scope.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current).toBe(false);

    const text = scope.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(result.current).toBe(false);

    act(() => {
      scope.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    expect(result.current).toBe(true);

    scope.remove();
    window.getSelection()?.removeAllRanges();
  });
});

describe("selectionVisibleInScope", () => {
  it("returns false when scope is null", () => {
    expect(selectionVisibleInScope(null)).toBe(false);
  });

  it("detects textarea selection inside scope", () => {
    const scope = document.createElement("div");
    const textarea = document.createElement("textarea");
    textarea.value = "Hello world";
    scope.appendChild(textarea);
    document.body.appendChild(scope);

    textarea.focus();
    textarea.setSelectionRange(0, 5);

    expect(selectionVisibleInScope(scope)).toBe(true);

    textarea.setSelectionRange(2, 2);
    expect(selectionVisibleInScope(scope)).toBe(true);

    scope.remove();
  });

  it("detects DOM selection inside scope", () => {
    const scope = document.createElement("div");
    scope.textContent = "Selectable paragraph";
    document.body.appendChild(scope);

    const range = document.createRange();
    range.selectNodeContents(scope);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(selectionVisibleInScope(scope)).toBe(true);

    selection?.removeAllRanges();
    expect(selectionVisibleInScope(scope)).toBe(false);

    scope.remove();
  });

  it("ignores selection outside scope", () => {
    const scope = document.createElement("div");
    scope.textContent = "Inside";
    const outside = document.createElement("p");
    outside.textContent = "Outside text";
    document.body.append(scope, outside);

    const range = document.createRange();
    range.selectNodeContents(outside);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(selectionVisibleInScope(scope)).toBe(false);

    selection?.removeAllRanges();
    scope.remove();
    outside.remove();
  });
});

describe("isInlineEditorToolbarTarget", () => {
  it("detects the floating toolbar and asset picker", () => {
    const toolbar = document.createElement("div");
    toolbar.className = "inline-selection-toolbar";
    const button = document.createElement("button");
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    expect(isInlineEditorToolbarTarget(button)).toBe(true);

    toolbar.remove();
  });

  it("ignores sidebar tree menus without editor floating chrome", () => {
    const treeMenu = document.createElement("div");
    treeMenu.setAttribute("role", "menu");
    treeMenu.className = "fixed z-overlay";
    const item = document.createElement("button");
    treeMenu.appendChild(item);
    document.body.appendChild(treeMenu);

    expect(isInlineEditorToolbarTarget(item)).toBe(false);
    expect(hasOpenInlineEditorPopover()).toBe(false);

    treeMenu.remove();
  });

  it("detects editor popovers marked with data-editor-floating-chrome", () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-editor-floating-chrome", "");
    menu.className = "fixed z-overlay";
    document.body.appendChild(menu);

    expect(hasOpenInlineEditorPopover()).toBe(true);

    menu.remove();
  });
});
