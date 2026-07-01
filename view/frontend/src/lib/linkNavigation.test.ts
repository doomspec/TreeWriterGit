import { describe, expect, it } from "vitest";

import {
  editorExternalLinkTitle,
  editorInternalLinkTitle,
  figureRefBadgeTitle,
  shouldNavigateLinkFromClick,
  viewerInternalLinkTitle,
} from "./linkNavigation";

describe("shouldNavigateLinkFromClick", () => {
  it("requires modifier for navigation", () => {
    expect(
      shouldNavigateLinkFromClick({
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
      } as MouseEvent),
    ).toBe(false);
    expect(
      shouldNavigateLinkFromClick({
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
      } as MouseEvent),
    ).toBe(true);
    expect(
      shouldNavigateLinkFromClick({
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        button: 0,
      } as MouseEvent),
    ).toBe(true);
  });

  it("does not navigate on shift or alt click", () => {
    expect(
      shouldNavigateLinkFromClick({
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        button: 0,
      } as MouseEvent),
    ).toBe(false);
    expect(
      shouldNavigateLinkFromClick({
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        button: 0,
      } as MouseEvent),
    ).toBe(false);
  });

  it("navigates on middle click", () => {
    expect(
      shouldNavigateLinkFromClick({
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 1,
      } as MouseEvent),
    ).toBe(true);
  });
});

describe("link title helpers", () => {
  it("uses platform-aware modifier labels", () => {
    expect(editorInternalLinkTitle()).toMatch(/Click to select/);
    expect(editorInternalLinkTitle("papers/foo/units/bar")).toContain("papers/foo/units/bar");
    expect(editorExternalLinkTitle()).toMatch(/new tab/i);
    expect(viewerInternalLinkTitle()).toBe("Click to open");
    expect(figureRefBadgeTitle()).toMatch(/figure/i);
  });
});
