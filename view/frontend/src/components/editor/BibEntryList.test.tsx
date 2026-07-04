/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { BibEntryList, BIB_ENTRY_LIST_ROW_HEIGHT } from "@/components/editor/BibEntryList";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * BIB_ENTRY_LIST_ROW_HEIGHT,
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, 5) }, (_, index) => ({
        index,
        key: index,
        start: index * BIB_ENTRY_LIST_ROW_HEIGHT,
        size: BIB_ENTRY_LIST_ROW_HEIGHT,
      })),
  }),
}));

const items = Array.from({ length: 20 }, (_, index) => ({
  citeKey: `key${index}`,
  title: `Title ${index} with enough text to span two lines in the list`,
  subtitle: `Author ${index}`,
  verifiedStatus: "unverified" as const,
}));

describe("BibEntryList", () => {
  it("assigns explicit height to each virtual row wrapper", () => {
    const { container } = render(
      <div style={{ height: 400, display: "flex", flexDirection: "column" }}>
        <BibEntryList items={items} selectedKey={null} onSelect={vi.fn()} />
      </div>,
    );

    const rows = container.querySelectorAll(".absolute.left-0.top-0");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const height = (row as HTMLElement).style.height;
      expect(height).toMatch(/^\d+px$/);
      expect(Number.parseInt(height, 10)).toBeGreaterThanOrEqual(40);
      expect(Number.parseInt(height, 10)).toBeLessThanOrEqual(BIB_ENTRY_LIST_ROW_HEIGHT);
    }
  });

  it("shows empty label when there are no items", () => {
    const { getByText } = render(
      <BibEntryList items={[]} selectedKey={null} onSelect={vi.fn()} emptyLabel="No matches." />,
    );
    expect(getByText("No matches.")).toBeTruthy();
  });
});
