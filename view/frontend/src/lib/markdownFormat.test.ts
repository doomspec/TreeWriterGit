import { describe, expect, it } from "vitest";

import { applyMarkdownFormat } from "./markdownFormat";

describe("applyMarkdownFormat", () => {
  it("wraps selection in bold markers", () => {
    const input = "hello world";
    const result = applyMarkdownFormat(input, 6, 11, "bold");
    expect(result.value).toBe("hello **world**");
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(13);
  });

  it("unwraps bold when already wrapped", () => {
    const input = "hello **world**";
    const result = applyMarkdownFormat(input, 6, 15, "bold");
    expect(result.value).toBe("hello world");
  });

  it("inserts empty bold markers at cursor", () => {
    const input = "hello";
    const result = applyMarkdownFormat(input, 5, 5, "bold");
    expect(result.value).toBe("hello****");
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(7);
  });

  it("wraps selection in italic markers", () => {
    const input = "hello world";
    const result = applyMarkdownFormat(input, 6, 11, "italic");
    expect(result.value).toBe("hello *world*");
  });

  it("sets heading level on selected line", () => {
    const input = "Title line\nNext line";
    const result = applyMarkdownFormat(input, 0, 10, "h2");
    expect(result.value).toBe("## Title line\nNext line");
  });

  it("clears heading prefix for paragraph", () => {
    const input = "## Summary\nBody";
    const result = applyMarkdownFormat(input, 0, 10, "paragraph");
    expect(result.value).toBe("Summary\nBody");
  });

  it("clears blockquote prefix for paragraph", () => {
    const input = "> quote me\nBody";
    const result = applyMarkdownFormat(input, 0, 10, "paragraph");
    expect(result.value).toBe("quote me\nBody");
  });

  it("clears nested blockquote prefixes for paragraph", () => {
    const input = "> > nested quote";
    const result = applyMarkdownFormat(input, 0, 16, "paragraph");
    expect(result.value).toBe("nested quote");
  });

  it("clears list prefixes for paragraph", () => {
    const input = "- one\n1. two";
    const result = applyMarkdownFormat(input, 0, 10, "paragraph");
    expect(result.value).toBe("one\ntwo");
  });

  it("prefixes bullet list lines", () => {
    const input = "one\ntwo";
    const result = applyMarkdownFormat(input, 0, 7, "bulletList");
    expect(result.value).toBe("- one\n- two");
  });

  it("prefixes ordered list lines", () => {
    const input = "one\ntwo";
    const result = applyMarkdownFormat(input, 0, 7, "orderedList");
    expect(result.value).toBe("1. one\n2. two");
  });

  it("prefixes blockquote lines", () => {
    const input = "quote me";
    const result = applyMarkdownFormat(input, 0, 8, "blockquote");
    expect(result.value).toBe("> quote me");
  });

  it("inserts link with empty label", () => {
    const input = "see ";
    const result = applyMarkdownFormat(input, 4, 4, "link");
    expect(result.value).toBe("see [](url)");
    expect(result.selectionStart).toBe(5);
    expect(result.selectionEnd).toBe(5);
  });

  it("wraps selection as link and selects url", () => {
    const input = "click here";
    const result = applyMarkdownFormat(input, 0, 10, "link");
    expect(result.value).toBe("[click here](url)");
    expect(result.selectionStart).toBe(result.value.indexOf("url"));
    expect(result.selectionEnd).toBe(result.selectionStart + 3);
  });
});
