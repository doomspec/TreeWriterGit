import { describe, expect, it } from "vitest";

import { changeAffectsGraph, createModelEventBroadcaster, resetModelEventBroadcastState } from "./modelEvents.js";
import { graphCacheSize, invalidateGraphCache } from "./graphCache.js";

describe("changeAffectsGraph", () => {
  it("ignores draft autosaves and session wiki logs", () => {
    expect(changeAffectsGraph("papers/demo/unit/draft.md")).toBe(false);
    expect(changeAffectsGraph("papers/demo/unit/draft.approved.md")).toBe(false);
    expect(changeAffectsGraph("papers/demo/notes/sessions/2026-06-23.md")).toBe(false);
  });

  it("treats INDEX and outline changes as graph-affecting", () => {
    expect(changeAffectsGraph("papers/demo/unit/INDEX.md")).toBe(true);
    expect(changeAffectsGraph("papers/demo/outline.md")).toBe(true);
  });
});

describe("createModelEventBroadcaster", () => {
  it("dedupes fs.watch events that follow an API broadcast", () => {
    resetModelEventBroadcastState();
    const sent: string[] = [];
    const clients = new Set([
      {
        readyState: 1,
        send: (payload: string) => sent.push(payload),
      },
    ]);
    const broadcast = createModelEventBroadcaster(clients, 1);
    const event = { type: "model-changed", path: "papers/demo/unit/draft.md" };

    broadcast(event, "api");
    broadcast(event, "watch");

    expect(sent).toHaveLength(1);
  });

  it("does not clear the entire graph cache for draft-only changes", () => {
    resetModelEventBroadcastState();
    invalidateGraphCache();
    const clients = new Set([
      {
        readyState: 1,
        send: () => {},
      },
    ]);
    const broadcast = createModelEventBroadcaster(clients, 1);
    broadcast({ type: "model-changed", path: "papers/demo/unit/draft.md" }, "api");
    expect(graphCacheSize()).toBe(0);
  });
});
