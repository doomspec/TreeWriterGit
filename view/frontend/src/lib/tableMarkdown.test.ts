import { describe, expect, it } from "vitest";

import { parseTableDraft, serializeTableDraft } from "./tableMarkdown";

const SAMPLE = `**Table1.** _Caption text._

| Value 1 | Value 2 |
| --- | --- |
| 123 | 134 |
|  |  |
`;

describe("parseTableDraft", () => {
  it("parses caption and gfm table", () => {
    const parsed = parseTableDraft(SAMPLE, "Table1");
    expect(parsed.label).toBe("Table1");
    expect(parsed.caption).toBe("Caption text.");
    expect(parsed.headers).toEqual(["Value 1", "Value 2"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual(["123", "134"]);
  });
});

describe("serializeTableDraft", () => {
  it("round-trips table draft", () => {
    const parsed = parseTableDraft(SAMPLE);
    const out = serializeTableDraft(parsed);
    const again = parseTableDraft(out);
    expect(again.label).toBe(parsed.label);
    expect(again.caption).toBe(parsed.caption);
    expect(again.headers).toEqual(parsed.headers);
    expect(again.rows).toEqual(parsed.rows);
  });
});
