import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  claimPresence,
  getPresence,
  heartbeatPresence,
  releasePresence,
  resetPresenceForTests,
} from "./presence.js";

beforeEach(() => {
  resetPresenceForTests();
});

afterEach(() => {
  resetPresenceForTests();
});

describe("presence", () => {
  it("claims and releases a path", () => {
    expect(claimPresence("papers/x/sections/a/draft.md", "Alice")).toBeNull();
    expect(getPresence("papers/x/sections/a/draft.md")).toEqual(
      expect.objectContaining({ user: "Alice" }),
    );
    releasePresence("papers/x/sections/a/draft.md", "Alice");
    expect(getPresence("papers/x/sections/a/draft.md")).toBeNull();
  });

  it("returns conflict when another user holds the path", () => {
    claimPresence("papers/x/draft.md", "Alice");
    const conflict = claimPresence("papers/x/draft.md", "Bob");
    expect(conflict).toEqual(expect.objectContaining({ user: "Alice" }));
  });

  it("extends claim on heartbeat", () => {
    claimPresence("papers/x/draft.md", "Alice");
    expect(heartbeatPresence("papers/x/draft.md", "Alice")).toBe(true);
    expect(heartbeatPresence("papers/x/draft.md", "Bob")).toBe(false);
  });
});
