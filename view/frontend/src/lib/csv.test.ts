import { describe, expect, it } from "vitest";

import { parseCsv, serializeCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses plain comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('name,note\n"Doe, John",hi\n')).toEqual([
      ["name", "note"],
      ["Doe, John", "hi"],
    ]);
  });

  it("handles quoted fields with embedded newlines", () => {
    expect(parseCsv('a,b\n"line one\nline two",x\n')).toEqual([
      ["a", "b"],
      ["line one\nline two", "x"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('a\n"she said ""hi"""\n')).toEqual([["a"], ['she said "hi"']]);
  });

  it("does not append a trailing empty row for a file ending in a newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("serializeCsv", () => {
  it("round-trips plain rows", () => {
    const rows = [
      ["a", "b"],
      ["1", "2"],
    ];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const rows = [["Doe, John", 'she said "hi"', "line one\nline two"]];
    const csv = serializeCsv(rows);
    expect(csv).toBe('"Doe, John","she said ""hi""","line one\nline two"');
    expect(parseCsv(csv)).toEqual(rows);
  });

  it("leaves plain fields unquoted", () => {
    expect(serializeCsv([["plain", "text"]])).toBe("plain,text");
  });
});
