import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEditorHistory } from "./editorHistoryCore";

describe("createEditorHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with initial value and no undo/redo", () => {
    const history = createEditorHistory("hello");
    expect(history.getValue()).toBe("hello");
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("groups rapid edits into one undo step", () => {
    const history = createEditorHistory("a");
    history.setValue("ab");
    history.setValue("abc");
    vi.advanceTimersByTime(400);

    expect(history.getValue()).toBe("abc");
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect(history.getValue()).toBe("a");
    expect(history.canRedo()).toBe(true);
  });

  it("redoes after undo", () => {
    const history = createEditorHistory("start");
    history.setValue("next");
    vi.advanceTimersByTime(400);

    history.undo();
    expect(history.getValue()).toBe("start");

    history.redo();
    expect(history.getValue()).toBe("next");
  });

  it("resetHistory clears stacks", () => {
    const history = createEditorHistory("old");
    history.setValue("changed");
    vi.advanceTimersByTime(400);

    history.resetHistory("fresh");
    expect(history.getValue()).toBe("fresh");
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
