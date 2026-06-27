import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  loadEditorSession,
  saveEditorSession,
  sessionKeyForComposedDraft,
  sessionKeyForFile,
} from "@/lib/editorSessionState";

describe("editorSessionState", () => {
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
    });
  });

  it("round-trips session state per file key", () => {
    const key = sessionKeyForFile("papers/demo/units/intro/outline.md");
    saveEditorSession(key, {
      paneMode: "raw",
      selectionStart: 12,
      selectionEnd: 18,
      scrollTop: 240,
    });
    expect(loadEditorSession(key)).toEqual({
      paneMode: "raw",
      selectionStart: 12,
      selectionEnd: 18,
      scrollTop: 240,
    });
  });

  it("uses separate keys for composed drafts", () => {
    const key = sessionKeyForComposedDraft("papers/demo/intro");
    saveEditorSession(key, { paneMode: "rendered", scrollTop: 80 });
    expect(loadEditorSession(key)?.scrollTop).toBe(80);
    expect(loadEditorSession(sessionKeyForFile("papers/demo/intro/outline.md"))).toBeNull();
  });
});
