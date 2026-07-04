/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import {
  isSidebarFloatingMenuOpen,
  registerSidebarFloatingMenuOpen,
} from "@/lib/sidebarFloatingMenu";

describe("sidebarFloatingMenu", () => {
  afterEach(() => {
    cleanup();
    document.body.removeAttribute("data-sidebar-floating-menu-open");
  });

  it("tracks open menus on document.body", () => {
    expect(isSidebarFloatingMenuOpen()).toBe(false);
    const close = registerSidebarFloatingMenuOpen();
    expect(isSidebarFloatingMenuOpen()).toBe(true);
    close();
    expect(isSidebarFloatingMenuOpen()).toBe(false);
  });
});
