/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import { computeFloatingMenuTop, getFloatingMenuMinTop } from "@/lib/floatingMenuPosition";

describe("floatingMenuPosition", () => {
  it("respects chrome header bottom when placing menus", () => {
    const header = document.createElement("div");
    header.className = "app-chrome-header";
    document.body.appendChild(header);
    header.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 44,
        left: 0,
        right: 800,
        width: 800,
        height: 44,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(getFloatingMenuMinTop()).toBe(48);

    const anchor = {
      top: 40,
      bottom: 56,
      left: 0,
      right: 100,
      width: 100,
      height: 16,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect;

    expect(computeFloatingMenuTop(anchor, 120)).toBeGreaterThanOrEqual(48);

    document.body.removeChild(header);
  });
});
