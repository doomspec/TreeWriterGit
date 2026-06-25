import { describe, expect, it } from "vitest";

import { lineInFullDocument, parsePreviewBody } from "@/components/editor/markdown/previewBody";

describe("lineInFullDocument", () => {
  it("maps preview body lines back into the saved file", () => {
    const full = `---
title: Demo
---

# Demo

First body line.
Second body line.`;
    const { body } = parsePreviewBody(full);
    expect(lineInFullDocument(full, body, 1)).toBe(7);
    expect(lineInFullDocument(full, body, 2)).toBe(8);
  });
});
