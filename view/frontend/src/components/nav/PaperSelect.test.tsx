/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PaperSelect } from "@/components/nav/PaperSelect";
import type { PaperSummary } from "@/modelApi";

const PAPERS: PaperSummary[] = [
  {
    slug: "vibecount",
    path: "papers/vibecount",
    title: "VibeCount",
    docType: "paper",
    journal: "PLOS ONE",
    status: "drafting",
    lastExport: null,
    tags: [],
    project: null,
    counts: { outline: 0, drafted: 0, approved: 0, total: 0 },
  },
  {
    slug: "cellpose",
    path: "papers/cellpose",
    title: "Cellpose",
    docType: "paper",
    journal: "",
    status: "drafting",
    lastExport: null,
    tags: [],
    project: null,
    counts: { outline: 0, drafted: 0, approved: 0, total: 0 },
  },
];

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

describe("PaperSelect", () => {
  let observerCallback: ObserverCallback | null = null;
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    disconnect = vi.fn();
    observerCallback = null;
    class FakeIntersectionObserver {
      constructor(callback: ObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows manuscript type instead of journal in the trigger and list", () => {
    render(
      <PaperSelect papers={PAPERS} selectedSlug="vibecount" loading={false} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /select manuscript/i }).textContent).toContain("Paper");
    expect(screen.getByRole("button", { name: /select manuscript/i }).textContent).not.toContain("PLOS ONE");

    fireEvent.click(screen.getByRole("button", { name: /select manuscript/i }));
    const option = screen.getByRole("option", { name: /vibecount/i });
    expect(option.textContent).toContain("Paper");
    expect(option.textContent).not.toContain("PLOS ONE");
  });

  it("filters papers by title via the in-dropdown search input", () => {
    render(
      <PaperSelect papers={PAPERS} selectedSlug="vibecount" loading={false} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /select manuscript/i }));
    const search = screen.getByRole("searchbox", { name: /search paper titles/i });
    expect(search).toBeTruthy();

    fireEvent.change(search, { target: { value: "cell" } });
    expect(screen.getByRole("option", { name: /cellpose/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /vibecount/i })).toBeNull();
  });

  it("closes the open menu when the trigger stops intersecting (sidebar hover-collapse)", () => {
    render(
      <PaperSelect papers={PAPERS} selectedSlug="vibecount" loading={false} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /select manuscript/i }));
    expect(screen.getByRole("listbox")).toBeTruthy();

    // Trigger goes `display: none` (sidebar collapses) — no resize/scroll event
    // fires, so only the intersection observer can catch this.
    act(() => {
      observerCallback?.([{ isIntersecting: false }]);
    });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not close the menu while the trigger stays visible", () => {
    render(
      <PaperSelect papers={PAPERS} selectedSlug="vibecount" loading={false} onChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /select manuscript/i }));
    act(() => {
      observerCallback?.([{ isIntersecting: true }]);
    });

    expect(screen.getByRole("listbox")).toBeTruthy();
  });
});
