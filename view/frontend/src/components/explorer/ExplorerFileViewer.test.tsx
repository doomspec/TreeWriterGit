/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/explorer/CodeFileEditor", () => ({
  CodeFileEditor: ({ path }: { path: string }) => <div data-testid="code">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerMarkdownEditor", () => ({
  ExplorerMarkdownEditor: ({ path }: { path: string }) => <div data-testid="markdown">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerCsvGrid", () => ({
  ExplorerCsvGrid: ({ path }: { path: string }) => <div data-testid="csv">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerXlsxViewer", () => ({
  ExplorerXlsxViewer: ({ path }: { path: string }) => <div data-testid="xlsx">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerPdfViewer", () => ({
  ExplorerPdfViewer: ({ path }: { path: string }) => <div data-testid="pdf">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerImageViewer", () => ({
  ExplorerImageViewer: ({ path }: { path: string }) => <div data-testid="image">{path}</div>,
}));
vi.mock("@/components/explorer/viewers/ExplorerDocxViewer", () => ({
  ExplorerDocxViewer: ({ path }: { path: string }) => <div data-testid="docx">{path}</div>,
}));

import { ExplorerFileViewer } from "@/components/explorer/ExplorerFileViewer";

describe("ExplorerFileViewer", () => {
  afterEach(() => cleanup());

  const cases: [string, string][] = [
    ["notes.md", "markdown"],
    ["README.markdown", "markdown"],
    ["data.csv", "csv"],
    ["book.xlsx", "xlsx"],
    ["legacy.xls", "xlsx"],
    ["report.pdf", "pdf"],
    ["photo.png", "image"],
    ["photo.JPG", "image"],
    ["diagram.svg", "image"],
    ["doc.docx", "docx"],
    ["script.ts", "code"],
    ["no-extension", "code"],
  ];

  it.each(cases)("routes %s to the %s viewer", (path, testId) => {
    render(<ExplorerFileViewer path={path} />);
    expect(screen.getByTestId(testId).textContent).toBe(path);
  });
});
