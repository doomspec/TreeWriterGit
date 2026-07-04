/** @vitest-environment jsdom */
import { createRef } from "react";

import { act, fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { NavigateTarget } from "@/lib/modelTree";

vi.mock("@/lib/bibLibraryStore", () => ({
  useBibSearchResults: () => ({
    entries: [
      { path: "", citeKey: "smith2020", title: "A Study", authors: "Smith", year: "2020", journal: null },
      { path: "", citeKey: "jones2019", title: "Another Paper", authors: "Jones", year: "2019", journal: null },
    ],
    total: 2,
    loading: false,
    refreshing: false,
    reload: async () => {},
  }),
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
});

import { ProseMirrorMarkdownField } from "@/components/editor/ProseMirrorMarkdownField";
import type { BlockMarkdownEditorHandle } from "@/components/editor/editorHandle";

function mount(value: string) {
  const onChange = vi.fn();
  const ref = createRef<BlockMarkdownEditorHandle>();
  const utils = render(
    <ProseMirrorMarkdownField value={value} onChange={onChange} editorRef={ref} ariaLabel="draft" />,
  );
  return { onChange, ref, ...utils };
}

describe("ProseMirrorMarkdownField", () => {
  it("mounts a contenteditable surface with the initial content", () => {
    const { container } = mount("Hello **world**.");
    const host = container.querySelector(".prosemirror-markdown-field");
    expect(host).not.toBeNull();
    expect(host?.textContent).toContain("Hello");
    expect(host?.querySelector("[contenteditable=true]")).not.toBeNull();
  });

  it("renders markdown as formatted DOM, not raw markers", () => {
    const { container } = mount("A **bold** word and a # not-heading.\n\n## Real Heading");
    const host = container.querySelector(".prosemirror-markdown-field")!;
    // bold renders as <strong>, the ** markers are gone
    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.textContent).not.toContain("**");
    // ATX heading renders as a heading element
    expect(host.querySelector("h2")?.textContent).toContain("Real Heading");
  });

  it("renders custom nodes as chips, not literal macros", () => {
    const { container } = mount("See [@smith2020] and [[papers/x/fig1|Figure 1]].");
    const host = container.querySelector(".prosemirror-markdown-field")!;
    // Citation renders via the CiteBadge node view.
    expect(host.querySelector(".latex-cite-badge")?.textContent).toContain("smith2020");
    expect(host.querySelector("[data-wikilink]")?.textContent).toBe("Figure 1");
  });

  it("mounts figure embeds through a React node view", () => {
    const { container } = mount("::figure[papers/x/figures/fig1]");
    expect(container.querySelector(".tw-node-view")).not.toBeNull();
  });

  it("@ opens the citation picker and inserts the chosen reference", () => {
    const onChange = vi.fn();
    const { container, getByText, getByPlaceholderText } = render(
      <ProseMirrorMarkdownField value="" onChange={onChange} editorRef={createRef<BlockMarkdownEditorHandle>()} />,
    );
    const editable = container.querySelector("[contenteditable=true]")!;
    fireEvent.keyDown(editable, { key: "@" });
    expect(getByPlaceholderText(/Cite/)).toBeTruthy();
    fireEvent.click(getByText("A Study")); // adds to selection
    fireEvent.click(getByText(/^Insert/)); // commits
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("[@smith2020]");
  });

  it("@ picker inserts multiple citations as [@a; @b]", () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <ProseMirrorMarkdownField value="" onChange={onChange} editorRef={createRef<BlockMarkdownEditorHandle>()} />,
    );
    fireEvent.keyDown(container.querySelector("[contenteditable=true]")!, { key: "@" });
    fireEvent.click(getByText("A Study"));
    fireEvent.click(getByText("Another Paper"));
    fireEvent.click(getByText(/^Insert/));
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("[@smith2020; @jones2019]");
  });

  it("exposes the BlockMarkdownEditor handle", () => {
    const { ref } = mount("First line.");
    expect(typeof ref.current?.isBlockEditing).toBe("function");
    expect(typeof ref.current?.getCursorLineNumber).toBe("function");
    expect(ref.current?.isBlockEditing()).toBe(false);
  });

  it("inserts a snippet as markdown and reports it via onChange", () => {
    const { ref, onChange } = mount("Intro paragraph.");
    act(() => {
      ref.current?.insertSnippet("::figure[papers/x/figures/a]");
    });
    const emitted = onChange.mock.calls.map((c) => c[0] as string);
    expect(emitted.some((md) => md.includes("::figure[papers/x/figures/a]"))).toBe(true);
  });

  it("clicking a citation opens the picker seeded with its key", () => {
    const ref = createRef<BlockMarkdownEditorHandle>();
    const { container, getByPlaceholderText, getByText } = render(
      <ProseMirrorMarkdownField
        value="See [@smith2020] here."
        onChange={vi.fn()}
        editorRef={ref}
        onNavigate={vi.fn()}
        linksClickable
      />,
    );
    fireEvent.click(container.querySelector(".latex-cite-badge")!);
    expect(getByPlaceholderText(/Cite/)).toBeTruthy();
    expect(getByText("@smith2020 ✕")).toBeTruthy(); // seeded chip
  });

  it("navigates a standard internal link on mod-click", () => {
    const onNavigate = vi.fn<(t: NavigateTarget) => void>();
    const ref = createRef<BlockMarkdownEditorHandle>();
    const { container } = render(
      <ProseMirrorMarkdownField
        value="* [Quick Start](quick-start/INDEX.md)"
        onChange={vi.fn()}
        editorRef={ref}
        onNavigate={onNavigate}
        linkContextPath="papers/treewriter-guide"
        linksClickable
      />,
    );
    fireEvent.click(container.querySelector("a[href]")!, { metaKey: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("exposes an open-hint tooltip on links and chips", () => {
    const { container } = render(
      <ProseMirrorMarkdownField
        value="See [@smith2020] and [Quick Start](quick-start/INDEX.md)."
        onChange={vi.fn()}
        editorRef={createRef<BlockMarkdownEditorHandle>()}
        onNavigate={vi.fn()}
        linksClickable
      />,
    );
    expect(container.querySelector("a[href]")?.getAttribute("title")).toMatch(/to open/i);
  });

  it("does not navigate a standard link when linksClickable is false", () => {
    const onNavigate = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    const { container } = render(
      <ProseMirrorMarkdownField
        value="[Quick Start](quick-start/INDEX.md)"
        onChange={vi.fn()}
        editorRef={ref}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(container.querySelector("a[href]")!, { metaKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("runFormat applies marks and block types, reflected in markdown", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    render(<ProseMirrorMarkdownField value="hello world" onChange={onChange} editorRef={ref} />);
    const md = () => (onChange.mock.calls.at(-1)?.[0] as string) ?? "";
    act(() => {
      ref.current?.runFormat?.("h2");
    });
    expect(md()).toContain("## hello world");
    act(() => {
      ref.current?.runFormat?.("bulletList");
    });
    expect(md()).toMatch(/^[-*] /m);
  });

  it("runFormat taskList produces a checkbox item", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    render(<ProseMirrorMarkdownField value="buy milk" onChange={onChange} editorRef={ref} />);
    act(() => {
      ref.current?.runFormat?.("taskList");
    });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("[ ] buy milk");
  });

  it("toggles a task checkbox on click of its box", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    const { container } = render(
      <ProseMirrorMarkdownField value="* [ ] do it" onChange={onChange} editorRef={ref} />,
    );
    const li = container.querySelector("li[data-task]")!;
    fireEvent.mouseDown(li, { clientX: 2, clientY: 2 });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("[x] do it");
  });

  it("runFormat codeBlock turns the line into a fenced block", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    render(<ProseMirrorMarkdownField value="some code" onChange={onChange} editorRef={ref} />);
    act(() => {
      ref.current?.runFormat?.("codeBlock");
    });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("```");
  });

  it("reports active block format at the caret (heading)", () => {
    const onActive = vi.fn();
    render(
      <ProseMirrorMarkdownField
        value="## Section title"
        onChange={vi.fn()}
        editorRef={createRef<BlockMarkdownEditorHandle>()}
        onActiveFormatsChange={onActive}
      />,
    );
    const last = onActive.mock.calls.at(-1)?.[0] as string[];
    expect(last).toContain("h2");
  });

  it("reports active task-list + bullet-list at the caret", () => {
    const onActive = vi.fn();
    render(
      <ProseMirrorMarkdownField
        value="* [ ] a task"
        onChange={vi.fn()}
        editorRef={createRef<BlockMarkdownEditorHandle>()}
        onActiveFormatsChange={onActive}
      />,
    );
    const last = onActive.mock.calls.at(-1)?.[0] as string[];
    expect(last).toContain("taskList");
    expect(last).toContain("bulletList");
  });

  it("undo reverts a native format change; redo reapplies it", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    render(<ProseMirrorMarkdownField value="plain text" onChange={onChange} editorRef={ref} />);
    expect(ref.current?.canUndo?.()).toBe(false);
    act(() => {
      ref.current?.runFormat?.("h2");
    });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("## plain text");
    expect(ref.current?.canUndo?.()).toBe(true);
    act(() => {
      ref.current?.runUndo?.();
    });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").not.toContain("## ");
    expect(ref.current?.canRedo?.()).toBe(true);
    act(() => {
      ref.current?.runRedo?.();
    });
    expect((onChange.mock.calls.at(-1)?.[0] as string) ?? "").toContain("## plain text");
  });

  it("find & replace overlay replaces text via the Replace button", () => {
    const onChange = vi.fn();
    const ref = createRef<BlockMarkdownEditorHandle>();
    const { container, getByPlaceholderText, getByText } = render(
      <ProseMirrorMarkdownField value="foo bar foo" onChange={onChange} editorRef={ref} />,
    );
    const editable = container.querySelector("[contenteditable=true]")!;
    fireEvent.keyDown(editable, { key: "f", metaKey: true, shiftKey: true });
    fireEvent.change(getByPlaceholderText(/^Find/), { target: { value: "foo" } });
    fireEvent.change(getByPlaceholderText("Replace"), { target: { value: "baz" } });
    fireEvent.click(getByText("Replace"));
    const last = (onChange.mock.calls.at(-1)?.[0] as string) ?? "";
    expect(last).toContain("baz bar foo");
  });

  it("getCursorLineNumber returns a positive line for a mounted doc", () => {
    const { ref } = mount("Line one.\n\nLine two.");
    const line = ref.current?.getCursorLineNumber();
    expect(line === null || (typeof line === "number" && line >= 1)).toBe(true);
  });
});
