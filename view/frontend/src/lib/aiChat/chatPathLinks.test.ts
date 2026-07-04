import { describe, expect, it } from "vitest";

import { normalizeChatPath, segmentChatText } from "@/lib/aiChat/chatPathLinks";

const CUR = "papers/vibecount/introduction";

describe("normalizeChatPath", () => {
  it("strips an absolute path through /model/", () => {
    expect(
      normalizeChatPath(
        "/Users/x/Documents/Github/TreeWriterGitOverleaf/model/papers/vibecount/introduction/hardware/draft.md",
        CUR,
      ),
    ).toBe("papers/vibecount/introduction/hardware/draft.md");
  });

  it("passes through a papers/ path", () => {
    expect(normalizeChatPath("papers/x/intro/draft.md", CUR)).toBe("papers/x/intro/draft.md");
  });

  it("strips a leading model/ prefix", () => {
    expect(normalizeChatPath("model/papers/x/draft.md", CUR)).toBe("papers/x/draft.md");
  });

  it("resolves a bracketed relative path against the current paper root", () => {
    expect(normalizeChatPath("[introduction/outline.md]", CUR)).toBe(
      "papers/vibecount/introduction/outline.md",
    );
  });

  it("drops trailing sentence punctuation", () => {
    expect(normalizeChatPath("papers/x/draft.md.", CUR)).toBe("papers/x/draft.md");
  });

  it("returns null for a relative path when there is no paper context", () => {
    expect(normalizeChatPath("intro/outline.md", "")).toBeNull();
  });
});

describe("segmentChatText", () => {
  it("splits text around a resolved absolute link", () => {
    const abs = "/repo/model/papers/vibecount/intro/hardware/draft.md";
    const segs = segmentChatText(`I fixed ${abs} for you.`, CUR);
    expect(segs).toEqual([
      { type: "text", value: "I fixed " },
      { type: "link", value: abs, path: "papers/vibecount/intro/hardware/draft.md" },
      { type: "text", value: " for you." },
    ]);
  });

  it("linkifies a bracketed relative path", () => {
    const segs = segmentChatText("Updated [introduction/outline.md] too.", CUR);
    expect(segs).toEqual([
      { type: "text", value: "Updated " },
      { type: "link", value: "[introduction/outline.md]", path: "papers/vibecount/introduction/outline.md" },
      { type: "text", value: " too." },
    ]);
  });

  it("leaves a lone filename (no slash) as plain text", () => {
    const segs = segmentChatText("Edit draft.md now.", CUR);
    expect(segs).toEqual([{ type: "text", value: "Edit draft.md now." }]);
  });

  it("returns a single text segment when there are no paths", () => {
    expect(segmentChatText("Just prose here.", CUR)).toEqual([
      { type: "text", value: "Just prose here." },
    ]);
  });

  it("handles multiple links in one message", () => {
    const segs = segmentChatText("papers/a/x.md and papers/b/y.md", CUR);
    expect(segs.filter((s) => s.type === "link").map((s) => s.type === "link" && s.path)).toEqual([
      "papers/a/x.md",
      "papers/b/y.md",
    ]);
  });
});
