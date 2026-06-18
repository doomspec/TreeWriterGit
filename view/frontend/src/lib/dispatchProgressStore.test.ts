import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDispatchJob,
  dispatchJobKey,
  loadDispatchJob,
  markDispatchInterrupted,
  saveDispatchJob,
} from "./dispatchProgressStore";

describe("dispatchProgressStore", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and loads jobs by key", () => {
    const jobKey = dispatchJobKey("section", "paper/intro", "outline");
    saveDispatchJob({
      jobKey,
      scope: "section",
      targetPath: "paper/intro",
      pane: "outline",
      action: "draft",
      progress: {
        phase: "running",
        action: "draft",
        total: 3,
        completed: 1,
        logs: ["Draft from outline · 3 units", "✓ unit-a"],
      },
      unitPaths: ["paper/intro/unit-a", "paper/intro/unit-b", "paper/intro/unit-c"],
      updatedAt: Date.now(),
    });

    const loaded = loadDispatchJob(jobKey);
    expect(loaded?.progress.completed).toBe(1);
    expect(loaded?.unitPaths).toHaveLength(3);
  });

  it("clears jobs", () => {
    const jobKey = dispatchJobKey("unit", "paper/intro/unit-a", "outline");
    saveDispatchJob({
      jobKey,
      scope: "unit",
      targetPath: "paper/intro/unit-a",
      pane: "outline",
      action: "draft",
      progress: {
        phase: "done",
        action: "draft",
        total: 1,
        completed: 1,
        logs: ["Complete"],
      },
      updatedAt: Date.now(),
    });
    clearDispatchJob(jobKey);
    expect(loadDispatchJob(jobKey)).toBeNull();
  });

  it("marks interrupted running jobs", () => {
    const jobKey = dispatchJobKey("unit", "paper/intro/unit-a", "draft");
    saveDispatchJob({
      jobKey,
      scope: "unit",
      targetPath: "paper/intro/unit-a",
      pane: "draft",
      action: "sync-outline",
      progress: {
        phase: "running",
        action: "sync-outline",
        total: 1,
        completed: 0,
        logs: ["Running agent…"],
      },
      updatedAt: Date.now(),
    });

    const progress = markDispatchInterrupted(jobKey);
    expect(progress?.phase).toBe("error");
    expect(progress?.logs.at(-1)).toContain("Interrupted by page reload");
    expect(loadDispatchJob(jobKey)?.progress.phase).toBe("error");
  });

  it("emits change events on save", () => {
    const listener = vi.fn();
    window.addEventListener("treewriter:dispatch-job", listener as EventListener);
    const jobKey = dispatchJobKey("section", "paper/methods", "draft");
    saveDispatchJob({
      jobKey,
      scope: "section",
      targetPath: "paper/methods",
      pane: "draft",
      action: "sync-outline",
      progress: {
        phase: "running",
        action: "sync-outline",
        total: 2,
        completed: 0,
        logs: ["Loading…"],
      },
      updatedAt: Date.now(),
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("treewriter:dispatch-job", listener as EventListener);
  });
});
