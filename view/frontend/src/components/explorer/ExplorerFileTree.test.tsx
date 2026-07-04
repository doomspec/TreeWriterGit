/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExplorerFileTree } from "@/components/explorer/ExplorerFileTree";

vi.mock("@/modelApi", () => ({
  fetchModelTree: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  deleteNode: vi.fn(),
  moveNode: vi.fn(),
}));

const { fetchModelTree } = await import("@/modelApi");

const ROOT_TREE = [
  { name: "papers", path: "papers", type: "directory" as const },
  { name: "main.bib", path: "main.bib", type: "file" as const },
];

describe("ExplorerFileTree", () => {
  beforeEach(() => {
    vi.mocked(fetchModelTree).mockReset();
    vi.mocked(fetchModelTree).mockResolvedValue({ root: "", treeVersion: 1, tree: ROOT_TREE });
  });

  afterEach(() => cleanup());

  it("loads and renders the root tree", async () => {
    render(<ExplorerFileTree activeFile={null} onOpenFile={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("papers")).toBeTruthy());
    expect(screen.getByText("main.bib")).toBeTruthy();
  });

  it("arrow-key navigation moves focus and Enter opens the focused file", async () => {
    const onOpenFile = vi.fn();
    render(<ExplorerFileTree activeFile={null} onOpenFile={onOpenFile} />);
    await waitFor(() => expect(screen.getByText("papers")).toBeTruthy());

    const tree = screen.getByRole("tree");
    await waitFor(() => expect(screen.getByText("main.bib")).toBeTruthy());
    fireEvent.keyDown(tree, { key: "Home" });
    fireEvent.keyDown(tree, { key: "ArrowDown" }); // papers -> main.bib
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(onOpenFile).toHaveBeenCalledWith("main.bib");
  });

  it("Enter on a focused folder expands it and loads its children", async () => {
    vi.mocked(fetchModelTree).mockImplementation(async (options) => {
      if (!options?.path) return { root: "", treeVersion: 1, tree: ROOT_TREE };
      return {
        root: "",
        treeVersion: 1,
        tree: [{ name: "vibecount", path: "papers/vibecount", type: "directory" as const }],
      };
    });
    render(<ExplorerFileTree activeFile={null} onOpenFile={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("papers")).toBeTruthy());

    // Default focus lands on the first row ("papers").
    fireEvent.keyDown(screen.getByRole("tree"), { key: "Enter" });
    await waitFor(() => expect(screen.getByText("vibecount")).toBeTruthy());
  });
});
