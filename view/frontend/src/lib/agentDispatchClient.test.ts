import { describe, expect, it } from "vitest";

import {
  dispatchActionForSectionPane,
  dispatchActionForUnitPane,
  dispatchActionLabel,
  dispatchHotActionLabel,
  hotDispatchActions,
  unitPathFromUnitFile,
} from "./agentDispatchClient";

describe("agentDispatchClient", () => {
  it("derives unit path from outline and draft files", () => {
    expect(unitPathFromUnitFile("papers/demo/intro/outline.md")).toBe("papers/demo/intro");
    expect(unitPathFromUnitFile("papers/demo/intro/draft.md")).toBe("papers/demo/intro");
    expect(unitPathFromUnitFile("papers/demo/intro/INDEX.md")).toBeNull();
  });

  it("maps section panes to dispatch actions", () => {
    expect(dispatchActionForSectionPane("outline")).toBe("summarize-outline");
    expect(dispatchActionForSectionPane("draft")).toBe("sync-outline");
  });

  it("maps pane labels to dispatch actions", () => {
    expect(dispatchActionForUnitPane("Outline", false)).toBe("draft");
    expect(dispatchActionForUnitPane("Draft", false)).toBe("sync-outline");
    expect(dispatchActionForUnitPane("Draft", true)).toBe("sync-outline");
    expect(dispatchActionForUnitPane(undefined, true)).toBeNull();
  });

  it("labels common actions for UI", () => {
    expect(dispatchActionLabel("draft")).toBe("Draft from outline");
    expect(dispatchActionLabel("revise")).toBe("Revise draft");
    expect(dispatchActionLabel("sync-outline")).toBe("Sync outline from draft");
    expect(dispatchActionLabel("summarize-outline")).toBe("Summarize outline from children");
  });

  it("labels hot dispatch buttons", () => {
    expect(dispatchHotActionLabel("draft")).toBe("Make draft");
    expect(dispatchHotActionLabel("summarize-outline")).toBe("Make outline");
    expect(dispatchHotActionLabel("revise")).toBe("Revise");
  });

  it("lists context-appropriate hot actions", () => {
    expect(hotDispatchActions({ isUnit: true, canFanOut: false })).toContain("revise");
    expect(hotDispatchActions({ isUnit: false, canFanOut: true })).toContain("summarize-outline");
  });
});
