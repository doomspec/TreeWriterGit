import { describe, expect, it } from "vitest";

import { shouldSyncDocumentOutline } from "@/components/editor/DualPaneController";

describe("DualPaneController", () => {
  describe("shouldSyncDocumentOutline", () => {
    it("syncs draft when draft pane is visible, otherwise outline", () => {
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: false, notes: false }, "outline"),
      ).toBe(true);
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: true, notes: false }, "draft"),
      ).toBe(true);
      expect(
        shouldSyncDocumentOutline({ outline: true, draft: true, notes: false }, "outline"),
      ).toBe(false);
      expect(
        shouldSyncDocumentOutline({ outline: false, draft: true, notes: true }, "draft"),
      ).toBe(true);
      expect(
        shouldSyncDocumentOutline({ outline: false, draft: true, notes: true }, "notes"),
      ).toBe(false);
    });
  });
});
