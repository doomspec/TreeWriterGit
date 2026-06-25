import { describe, expect, it } from "vitest";

import {
  sanitizeEditorPanePrefsByScope,
  resolveEditorPanePrefsScopePath,
  upsertEditorPanePrefsByScope,
} from "@/lib/editorPaneScopePrefs";

describe("editorPaneScopePrefs", () => {
  it("resolves paper-level prefs scope for sections and units", () => {
    expect(
      resolveEditorPanePrefsScopePath("papers/demo/sections/intro", "papers/demo"),
    ).toBe("papers/demo");
    expect(
      resolveEditorPanePrefsScopePath("papers/demo/sections/intro/units/a", "papers/demo"),
    ).toBe("papers/demo");
    expect(resolveEditorPanePrefsScopePath("papers/demo", "papers/demo")).toBe("papers/demo");
    expect(resolveEditorPanePrefsScopePath("papers/other", "papers/demo")).toBe("papers/other");
    expect(resolveEditorPanePrefsScopePath(null, "papers/demo")).toBeNull();
  });

  it("sanitizes invalid scope keys", () => {
    expect(
      sanitizeEditorPanePrefsByScope({
        "papers/demo": { visible: { outline: true, draft: true, notes: false }, active: "draft" },
        invalid: { visible: { outline: true, draft: false, notes: false }, active: "outline" },
      }),
    ).toEqual({
      "papers/demo": { visible: { outline: true, draft: true, notes: false }, active: "draft" },
    });
  });

  it("moves updated scope to the end and trims LRU overflow", () => {
    const initial = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [
        `papers/paper-${index}`,
        { visible: { outline: true, draft: true, notes: false }, active: "draft" as const },
      ]),
    );
    const next = upsertEditorPanePrefsByScope(initial, "papers/new", {
      visible: { outline: false, draft: true, notes: true },
      active: "notes",
    });
    const keys = Object.keys(next);
    expect(keys).toHaveLength(30);
    expect(keys.at(-1)).toBe("papers/new");
    expect(next["papers/new"]).toEqual({
      visible: { outline: false, draft: true, notes: true },
      active: "notes",
    });
    expect(next["papers/paper-0"]).toBeUndefined();
  });
});
