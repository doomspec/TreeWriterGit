/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ExplorerPdfViewer } from "@/components/explorer/viewers/ExplorerPdfViewer";

describe("ExplorerPdfViewer", () => {
  afterEach(() => cleanup());

  it("embeds the PDF and links to open it in a new tab", () => {
    const { container } = render(<ExplorerPdfViewer path="explorer/report.pdf" />);
    const embed = container.querySelector("embed");
    expect(embed?.getAttribute("type")).toBe("application/pdf");
    expect(embed?.getAttribute("src")).toContain("/api/model/asset?path=explorer%2Freport.pdf");

    const link = screen.getByRole("link", { name: /Open in new tab/i }) as HTMLAnchorElement;
    expect(link.href).toContain("/api/model/asset?path=explorer%2Freport.pdf");
    expect(link.target).toBe("_blank");
  });
});
