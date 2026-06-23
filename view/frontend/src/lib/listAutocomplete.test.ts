import { describe, expect, it } from "vitest";

import { continueListOnEnter } from "./listAutocomplete";

describe("continueListOnEnter", () => {
  it("inserts the next bullet on Enter", () => {
    const value = "- adf\n-adf";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("- adf\n-adf\n- ");
    expect(result?.selectionStart).toBe(result?.value.length);
  });

  it("continues bullets without a space after the marker", () => {
    const value = "-adf";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("-adf\n- ");
  });

  it("continues a bullet mid-document", () => {
    const value = "## Summary\n\n- first item";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("## Summary\n\n- first item\n- ");
    expect(result?.selectionStart).toBe(result?.value.length);
  });

  it("continues ordered lists with the next number", () => {
    const value = "1. one\n2. two";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("1. one\n2. two\n3. ");
  });

  it("exits the list on Enter for an empty bullet", () => {
    const value = "- adf\n- ";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("- adf\n");
    expect(result?.selectionStart).toBe(result?.value.length);
  });

  it("preserves indentation for nested bullets", () => {
    const value = "  - nested";
    const cursor = value.length;
    const result = continueListOnEnter(value, cursor, cursor);
    expect(result?.value).toBe("  - nested\n  - ");
  });

  it("returns null for non-list lines", () => {
    const value = "plain paragraph";
    expect(continueListOnEnter(value, value.length, value.length)).toBeNull();
  });
});
