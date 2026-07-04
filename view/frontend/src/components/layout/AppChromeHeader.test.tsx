/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AppChromeHeader } from "@/components/layout/AppChromeHeader";

vi.mock("@/lib/readingFocus", () => ({
  useReadingFocus: () => ({
    active: false,
    extraChrome: null,
    enter: vi.fn(),
    exit: vi.fn(),
    toggle: vi.fn(),
    setExtraChrome: vi.fn(),
  }),
}));

describe("AppChromeHeader", () => {
  afterEach(() => cleanup());

  const baseProps = {
    appView: "workspace" as const,
    browsePath: "papers/demo",
    onNavigate: vi.fn(),
    onRefreshModel: vi.fn(),
    onToggleAiPanel: vi.fn(),
  };

  it("renders sidebar-aligned brand cluster in writer workspace mode", () => {
    const { container } = render(
      <AppChromeHeader
        {...baseProps}
        onHomeClick={vi.fn()}
        homeTitle="Home"
      />,
    );
    expect(container.querySelector(".app-chrome-header--sidebar-aligned")).toBeTruthy();
    expect(container.querySelector(".app-chrome-header__brand")).toBeTruthy();
    const brand = container.querySelector(".app-chrome-header__brand");
    expect(brand?.textContent).toContain("TreeWriter");
  });

  it("pins workspace actions on the far right with ml-auto", () => {
    const { container } = render(
      <AppChromeHeader {...baseProps} aiPanelOpen onToggleAiPanel={vi.fn()} />,
    );
    const actions = container.querySelector(".app-chrome-header__actions");
    expect(actions).toBeTruthy();
    expect(actions?.className).toMatch(/ml-auto/);
    expect(screen.getByRole("button", { name: /close assistant panel/i })).toBeTruthy();
  });

  it("uses combined brand in explorer mode without sidebar-aligned rail", () => {
    const { container } = render(
      <AppChromeHeader {...baseProps} explorerMode onHomeClick={vi.fn()} />,
    );
    expect(container.querySelector(".app-chrome-header--sidebar-aligned")).toBeNull();
    expect(container.querySelector(".app-chrome-header__brand-rail")).toBeNull();
  });
});
