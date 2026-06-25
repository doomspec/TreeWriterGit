/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { BlockMarkdownEditor } from "@/components/editor/BlockMarkdownEditor";
import { editableHtmlToMarkdown } from "@/lib/markdownRoundtrip";

describe("BlockMarkdownEditor", () => {
  it("renders markdown blocks and preserves roundtrip text", () => {
    const markdown = "# Title\n\nParagraph with **bold** text.\n";
    const onChange = vi.fn();
    render(
      <BlockMarkdownEditor
        value={markdown}
        onChange={onChange}
        linkContextPath="papers/demo"
      />,
    );
    expect(document.body.textContent).toContain("Title");
    expect(document.body.textContent).toContain("bold");
    const restored = editableHtmlToMarkdown(document.body.innerHTML);
    expect(restored).toContain("Paragraph");
  });
});
