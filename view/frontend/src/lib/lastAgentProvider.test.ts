import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadLastAgentProvider,
  resolveAgentProvider,
  saveLastAgentProvider,
} from "./lastAgentProvider";

const STORAGE_KEY = "treewriter.lastAgentProvider.v1";

describe("lastAgentProvider", () => {
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
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and loads the last used provider", () => {
    saveLastAgentProvider("Codex");
    expect(loadLastAgentProvider()).toBe("Codex");
  });

  it("prefers last used provider when still available", () => {
    saveLastAgentProvider("Codex");
    expect(resolveAgentProvider("Claude Code", ["Claude Code", "Codex"])).toBe("Codex");
  });

  it("falls back to config default when last used is unavailable", () => {
    saveLastAgentProvider("Old Tool");
    expect(resolveAgentProvider("Claude Code", ["Claude Code", "Codex"])).toBe("Claude Code");
  });
});
