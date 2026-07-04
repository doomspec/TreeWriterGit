import { describe, expect, it } from "vitest";

import {
  enrichModelEvent,
  inferModelEventKind,
  resetModelEventBroadcastState,
} from "./modelEvents.js";

describe("enrichModelEvent", () => {
  it("tags draft saves as content and bumps treeVersion only for structure", () => {
    resetModelEventBroadcastState();
    const draft = enrichModelEvent({ type: "model-changed", path: "papers/demo/unit/draft.md" });
    expect(draft.kind).toBe("content");
    expect(draft.treeVersion).toBe(0);

    const structure = enrichModelEvent({ type: "model-changed", path: "papers/demo/unit/INDEX.md" });
    expect(structure.kind).toBe("structure");
    expect(structure.treeVersion).toBe(1);
  });

  it("infers comments kind for comment events", () => {
    expect(inferModelEventKind("papers/demo/unit/draft.md")).toBe("content");
    expect(inferModelEventKind("papers/demo/unit/temp-notes.md")).toBe("content");
    expect(inferModelEventKind("papers/demo/unit/INDEX.md")).toBe("structure");
  });
});
