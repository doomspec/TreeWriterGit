import { afterEach, describe, expect, it, vi } from "vitest";

import { markSelfSave, wasRecentlySelfSaved } from "@/lib/recentSelfSaves";

describe("recentSelfSaves", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a just-marked path as recently self-saved", () => {
    markSelfSave("papers/demo/unit-a/draft.md");
    expect(wasRecentlySelfSaved("papers/demo/unit-a/draft.md")).toBe(true);
  });

  it("returns false for a path that was never marked", () => {
    expect(wasRecentlySelfSaved("papers/demo/unit-b/draft.md")).toBe(false);
  });

  it("consumes the mark so a second (genuinely external) event is not swallowed", () => {
    markSelfSave("papers/demo/unit-c/draft.md");
    expect(wasRecentlySelfSaved("papers/demo/unit-c/draft.md")).toBe(true);
    // Second check (e.g. a later external edit's broadcast) must not be treated
    // as self — the mark is single-use.
    expect(wasRecentlySelfSaved("papers/demo/unit-c/draft.md")).toBe(false);
  });

  it("normalizes backslash paths so a Windows-style event still matches", () => {
    markSelfSave("papers/demo/unit-d/draft.md");
    expect(wasRecentlySelfSaved("papers\\demo\\unit-d\\draft.md")).toBe(true);
  });

  it("expires a stale mark past the TTL", () => {
    vi.useFakeTimers();
    // performance.now advances with fake timers in happy-dom/node.
    markSelfSave("papers/demo/unit-e/draft.md");
    vi.advanceTimersByTime(5_000);
    expect(wasRecentlySelfSaved("papers/demo/unit-e/draft.md")).toBe(false);
  });
});
