/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const SAMPLE_SHEETS = [
  {
    sheet: "People",
    data: [
      ["name", "age"],
      ["Ada", 36],
    ],
  },
  {
    sheet: "Notes",
    data: [["only one cell"]],
  },
];

const readXlsxFile = vi.fn(async (..._args: unknown[]) => SAMPLE_SHEETS);
vi.mock("read-excel-file/browser", () => ({ default: (...args: unknown[]) => readXlsxFile(...args) }));

const fetchModelAssetBytes = vi.fn(async (..._args: unknown[]) => new ArrayBuffer(0));
vi.mock("@/modelApi", () => ({ fetchModelAssetBytes: (...args: unknown[]) => fetchModelAssetBytes(...args) }));

import { ExplorerXlsxViewer } from "@/components/explorer/viewers/ExplorerXlsxViewer";

describe("ExplorerXlsxViewer", () => {
  afterEach(() => cleanup());

  it("renders the first sheet as a read-only table", async () => {
    render(<ExplorerXlsxViewer path="explorer/data.xlsx" />);
    expect(await screen.findByText("name")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("36")).toBeTruthy();
  });

  it("shows a sheet tab strip and switches sheets on click", async () => {
    render(<ExplorerXlsxViewer path="explorer/data.xlsx" />);
    await screen.findByText("Ada");
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    await waitFor(() => {
      expect(screen.getByText("only one cell")).toBeTruthy();
    });
    expect(screen.queryByText("Ada")).not.toBeTruthy();
  });

  it("surfaces a fetch error", async () => {
    fetchModelAssetBytes.mockRejectedValueOnce(new Error("boom"));
    const onError = vi.fn();
    render(<ExplorerXlsxViewer path="explorer/data.xlsx" onError={onError} />);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("boom");
    });
    expect(screen.getByText("boom")).toBeTruthy();
  });
});
