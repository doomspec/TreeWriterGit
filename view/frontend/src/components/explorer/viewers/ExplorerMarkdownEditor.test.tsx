/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi, beforeAll } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/bibLibraryStore", () => ({
  useBibSearchResults: () => ({ entries: [], total: 0, loading: false, refreshing: false, reload: async () => {} }),
}));

vi.mock("@/lib/draftApproval", async () => {
  const actual = await vi.importActual<typeof import("@/lib/draftApproval")>("@/lib/draftApproval");
  return {
    ...actual,
    loadModelFileContent: vi.fn(async () => "# Hello\n\nWorld.\n"),
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

vi.mock("@/modelApi", () => ({
  saveModelFile: vi.fn(async () => {}),
}));

// jsdom has no layout engine; ProseMirror's scroll-into-view needs these.
beforeAll(() => {
  const emptyRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const emptyRects = () => Object.assign([] as unknown[], { item: () => null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getClientRects = emptyRects;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getBoundingClientRect = emptyRect;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).getClientRects = emptyRects;
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
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

import { ExplorerMarkdownEditor } from "@/components/explorer/viewers/ExplorerMarkdownEditor";
import { ReadingFocusProvider } from "@/lib/readingFocus";

describe("ExplorerMarkdownEditor", () => {
  afterEach(() => cleanup());

  it("loads the file and shows the formatting toolbar with no Comment button", async () => {
    render(<ExplorerMarkdownEditor path="explorer/notes.md" />);
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Comment" })).not.toBeTruthy();
    expect(screen.queryByRole("button", { name: "Highlight selection" })).not.toBeTruthy();
    expect(screen.getByRole("button", { name: "Source" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Split" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
  });

  it("orders the toolbar as filename, formatting tools, saved status, then layout toggle", async () => {
    render(<ExplorerMarkdownEditor path="explorer/notes.md" />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeTruthy());
    const filename = screen.getByTitle("explorer/notes.md");
    const formatTools = screen.getByRole("button", { name: "Formatting tools" });
    const saved = screen.getByText("Saved");
    const sourceToggle = screen.getByRole("button", { name: "Source" });
    expect(filename.compareDocumentPosition(formatTools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(formatTools.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(saved.compareDocumentPosition(sourceToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("switching to Source shows a raw textarea with the loaded content", async () => {
    render(<ExplorerMarkdownEditor path="explorer/notes.md" />);
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const textarea = await screen.findByLabelText("Raw markdown source");
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain("# Hello");
    });
  });

  it("editing the raw textarea updates the tracked content", async () => {
    render(<ExplorerMarkdownEditor path="explorer/notes.md" />);
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const textarea = (await screen.findByLabelText("Raw markdown source")) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toContain("# Hello"));
    fireEvent.change(textarea, { target: { value: "# Edited\n" } });
    expect(textarea.value).toBe("# Edited\n");
  });

  it("uses centered reading layout and focus edit bar when reading focus is active", async () => {
    window.localStorage.setItem("treewriter.readingFocus.v1", "true");
    render(
      <ReadingFocusProvider>
        <ExplorerMarkdownEditor path="view/integrated-terminal.md" />
      </ReadingFocusProvider>,
    );
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeTruthy());
    expect(document.querySelector(".reading-focus-pane")).toBeTruthy();
    expect(screen.getByText("integrated-terminal.md")).toBeTruthy();
    expect(screen.queryByTitle("view/integrated-terminal.md")).not.toBeTruthy();
    window.localStorage.removeItem("treewriter.readingFocus.v1");
  });
});
