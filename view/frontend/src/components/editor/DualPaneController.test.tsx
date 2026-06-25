import { describe, expect, it } from "vitest";

import { shouldSyncDocumentOutline } from "@/components/editor/DualPaneController";

describe("DualPaneController", () => {
  describe("shouldSyncDocumentOutline", () => {
    it("syncs when outline is visible and focused in a split", () => {
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: false, notes: false }, "outline"),
      ).toBe(true);
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: true, notes: false }, "outline"),
      ).toBe(true);
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: true, notes: false }, "draft"),
      ).toBe(false);
      expect(
        shouldSyncDocumentOutline({ outline: false, draft: true, notes: true }, "notes"),
      ).toBe(false);
    });
  });
});
