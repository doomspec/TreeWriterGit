import { describe, expect, it } from "vitest";

import { restoreDispatchPreview } from "@/lib/dispatchPanelState";

describe("restoreDispatchPreview", () => {
  it("returns null for missing preview", () => {
    expect(restoreDispatchPreview(null)).toBeNull();
    expect(restoreDispatchPreview(undefined)).toBeNull();
  });

  it("fills missing outputPath for type-safe restore", () => {
    expect(
      restoreDispatchPreview({
        prompt: "Write intro",
        command: "agent draft",
      }),
    ).toEqual({
      prompt: "Write intro",
      command: "agent draft",
      outputPath: "",
    });
  });

  it("preserves outputPath when present", () => {
    expect(
      restoreDispatchPreview({
        prompt: "Write intro",
        command: "agent draft",
        outputPath: "papers/demo/intro/draft.md",
      }),
    ).toEqual({
      prompt: "Write intro",
      command: "agent draft",
      outputPath: "papers/demo/intro/draft.md",
    });
  });
});
