import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  saveWorkspacePreferences,
} from "@/lib/workspacePreferences";

describe("workspacePreferences sidebar panel", () => {
  const storage = { store: {} as Record<string, string> };

  beforeEach(() => {
    storage.store = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return storage.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        storage.store[key] = value;
      },
      removeItem(key: string) {
        delete storage.store[key];
      },
      clear() {
        storage.store = {};
      },
    });
  });

  it("defaults sidebar panel to paperInfo and open", () => {
    const prefs = mergeWorkspaceDefaults({});
    expect(prefs.sidebarPanel).toBe("paperInfo");
    expect(prefs.sidebarPanelOpen).toBe(true);
  });

  it("migrates legacy findPaper to paperInfo", () => {
    storage.store["treewriter.workspace.v1"] = JSON.stringify({ sidebarPanel: "findPaper" });
    const loaded = mergeWorkspaceDefaults(loadWorkspacePreferences());
    expect(loaded.sidebarPanel).toBe("paperInfo");
  });

  it("migrates legacy sidebarTab to sidebarPanel", () => {
    storage.store["treewriter.workspace.v1"] = JSON.stringify({ sidebarTab: "explorer" });
    const loaded = mergeWorkspaceDefaults(loadWorkspacePreferences());
    expect(loaded.sidebarPanel).toBe("papers");
  });

  it("migrates legacy outline panel to paperInfo", () => {
    storage.store["treewriter.workspace.v1"] = JSON.stringify({ sidebarPanel: "outline" });
    const loaded = mergeWorkspaceDefaults(loadWorkspacePreferences());
    expect(loaded.sidebarPanel).toBe("paperInfo");
  });

  it("persists sidebar panel prefs", () => {
    saveWorkspacePreferences({ sidebarPanel: "graph", sidebarPanelOpen: false, sidebarPinned: false });
    const loaded = mergeWorkspaceDefaults(loadWorkspacePreferences());
    expect(loaded.sidebarPanel).toBe("graph");
    expect(loaded.sidebarPanelOpen).toBe(false);
    expect(loaded.sidebarPinned).toBe(false);
  });
});
