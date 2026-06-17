import { describe, expect, it } from "vitest";

import {
  dispatchActionForUnitPane,
  dispatchActionLabel,
  unitPathFromUnitFile,
} from "./agentDispatchClient";

describe("agentDispatchClient", () => {
  it("derives unit path from outline and draft files", () => {
    expect(unitPathFromUnitFile("papers/demo/intro/outline.md")).toBe("papers/demo/intro");
    expect(unitPathFromUnitFile("papers/demo/intro/draft.md")).toBe("papers/demo/intro");
    expect(unitPathFromUnitFile("papers/demo/intro/INDEX.md")).toBeNull();
  });

  it("maps pane labels to dispatch actions", () => {
    expect(dispatchActionForUnitPane("Outline", false)).toBe("draft");
    expect(dispatchActionForUnitPane("Draft", false)).toBe("draft");
    expect(dispatchActionForUnitPane("Draft", true)).toBe("revise");
    expect(dispatchActionForUnitPane(undefined, true)).toBeNull();
  });

  it("labels common actions for UI", () => {
    expect(dispatchActionLabel("draft")).toBe("Draft from outline");
    expect(dispatchActionLabel("revise")).toBe("Revise draft");
  });
});
