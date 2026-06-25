import { describe, expect, it } from "vitest";

import {
  isTempNotesPlaceholderContent,
  tempNotesContentForEditor,
  normalizeLoadedContentForPath,
} from "@/lib/tempNotes";

describe("tempNotes placeholder", () => {
  it("treats empty and skeleton content as placeholder", () => {
    expect(isTempNotesPlaceholderContent("")).toBe(true);
    expect(
      isTempNotesPlaceholderContent(
        "# Notes\n\n_Scratchpad — not exported; no approval required._\n",
      ),
    ).toBe(true);
    expect(
      isTempNotesPlaceholderContent(
        "# Notes\n\n\\*Scratchpad — not exported; no approval required\\*\n",
      ),
    ).toBe(true);
  });

  it("keeps user-authored notes", () => {
    expect(isTempNotesPlaceholderContent("Meeting notes from Tuesday\n")).toBe(false);
    expect(isTempNotesPlaceholderContent("# Notes\n\nMy actual note.\n")).toBe(false);
  });

  it("normalizes placeholder to empty editor content", () => {
    expect(tempNotesContentForEditor("# Notes\n\n_Scratchpad — not exported; no approval required._")).toBe(
      "",
    );
    expect(tempNotesContentForEditor("Real note")).toBe("Real note");
  });

  it("only normalizes temp-notes paths", () => {
    expect(normalizeLoadedContentForPath("papers/x/outline.md", "# Title\n")).toBe("# Title\n");
    expect(
      normalizeLoadedContentForPath(
        "papers/x/temp-notes.md",
        "# Notes\n\n_Scratchpad — not exported; no approval required._",
      ),
    ).toBe("");
  });
});
