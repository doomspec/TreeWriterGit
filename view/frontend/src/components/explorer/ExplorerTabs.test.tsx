/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ExplorerTabs } from "@/components/explorer/ExplorerTabs";

describe("ExplorerTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there are no open tabs", () => {
    const { container } = render(
      <ExplorerTabs tabs={[]} activeTab={null} onSelect={vi.fn()} onClose={vi.fn()} onCloseAll={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("keeps full tab labels and always shows tab-list controls", () => {
    render(
      <ExplorerTabs
        tabs={["View/integrated-terminal.md", "View/status-column.md"]}
        activeTab="View/integrated-terminal.md"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: /integrated-terminal\.md/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /status-column\.md/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All open tabs" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close all tabs" })).not.toBeTruthy();
    expect(screen.getByRole("tablist").className.includes("explorer-tabs__strip")).toBe(true);
  });

  it("lists every open tab and selects one from the dropdown", () => {
    const onSelect = vi.fn();
    render(
      <ExplorerTabs
        tabs={["papers/a/outline.md", "papers/b/draft.md"]}
        activeTab="papers/a/outline.md"
        onSelect={onSelect}
        onClose={vi.fn()}
        onCloseAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All open tabs" }));
    const menu = screen.getByRole("menu");
    expect(menu.className.includes("explorer-tabs__menu")).toBe(true);
    expect(menu.className.includes("explorer-theme")).toBe(true);
    expect(menu.className.includes("bg-card")).toBe(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "draft.md" }));
    expect(onSelect).toHaveBeenCalledWith("papers/b/draft.md");
  });

  it("closes all tabs from the open-tabs menu", () => {
    const onCloseAll = vi.fn();
    render(
      <ExplorerTabs
        tabs={["papers/a/outline.md", "papers/b/draft.md"]}
        activeTab="papers/a/outline.md"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseAll={onCloseAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All open tabs" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close all tabs" }));
    expect(onCloseAll).toHaveBeenCalledOnce();
  });

  it("closing a single tab still works via its X button", () => {
    const onClose = vi.fn();
    render(
      <ExplorerTabs
        tabs={["a.md", "b.md"]}
        activeTab="a.md"
        onSelect={vi.fn()}
        onClose={onClose}
        onCloseAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close a.md" }));
    expect(onClose).toHaveBeenCalledWith("a.md");
  });
});
