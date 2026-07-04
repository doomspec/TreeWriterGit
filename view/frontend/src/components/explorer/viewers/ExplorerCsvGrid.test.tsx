/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi, beforeAll } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/draftApproval", async () => {
  const actual = await vi.importActual<typeof import("@/lib/draftApproval")>("@/lib/draftApproval");
  return {
    ...actual,
    loadModelFileContent: vi.fn(async () => "name,age\nAda,36\n"),
    loadDraftApprovalState: vi.fn(async () => ({
      content: "",
      meta: {
        editedBy: null,
        editedAt: null,
        aiAssisted: false,
        aiProvider: null,
        approvedBy: null,
        approvedAt: null,
      },
    })),
  };
});

const saveModelFile = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/modelApi", () => ({ saveModelFile: (...args: unknown[]) => saveModelFile(...args) }));

beforeAll(() => {
  if (!window.localStorage) {
    const store = new Map<string, string>();
    window.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  }
});

import { ExplorerCsvGrid } from "@/components/explorer/viewers/ExplorerCsvGrid";

describe("ExplorerCsvGrid", () => {
  afterEach(() => cleanup());

  it("renders parsed CSV rows as a grid of editable cells", async () => {
    render(<ExplorerCsvGrid path="explorer/people.csv" />);
    const nameCell = await screen.findByDisplayValue("name");
    expect(nameCell).toBeTruthy();
    expect(screen.getByDisplayValue("Ada")).toBeTruthy();
    expect(screen.getByDisplayValue("36")).toBeTruthy();
  });

  it("editing a cell serializes the grid back to CSV and saves it", async () => {
    render(<ExplorerCsvGrid path="explorer/people.csv" />);
    const ageCell = (await screen.findByDisplayValue("36")) as HTMLInputElement;
    fireEvent.change(ageCell, { target: { value: "37" } });
    await waitFor(() => {
      expect(saveModelFile).toHaveBeenCalledWith(
        "explorer/people.csv",
        "name,age\r\nAda,37",
        expect.anything(),
      );
    });
  });

  it("adds a row via the toolbar", async () => {
    render(<ExplorerCsvGrid path="explorer/people.csv" />);
    await screen.findByDisplayValue("Ada");
    fireEvent.click(screen.getByRole("button", { name: "Row" }));
    expect(screen.getByLabelText("Row 3, column 1")).toBeTruthy();
  });

  it("adds a column via the toolbar", async () => {
    render(<ExplorerCsvGrid path="explorer/people.csv" />);
    await screen.findByDisplayValue("Ada");
    fireEvent.click(screen.getByRole("button", { name: "Column" }));
    expect(screen.getByLabelText("Row 1, column 3")).toBeTruthy();
  });

  it("deletes a row", async () => {
    render(<ExplorerCsvGrid path="explorer/people.csv" />);
    await screen.findByDisplayValue("Ada");
    fireEvent.click(screen.getByRole("button", { name: "Delete row 2" }));
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Ada")).not.toBeTruthy();
    });
    expect(screen.getByDisplayValue("name")).toBeTruthy();
  });
});
