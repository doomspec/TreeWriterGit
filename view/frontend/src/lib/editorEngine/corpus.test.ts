import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { roundtrip } from "./roundtrip";

const GUIDE = join(__dirname, "../../../../../model/papers/treewriter-guide");

function collectDrafts(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectDrafts(full, out);
    else if (entry === "draft.md" || entry === "draft.approved.md") out.push(full);
  }
  return out;
}

const PATTERNS: Array<[string, RegExp]> = [
  ["::figure", /::figure\[/g],
  ["::equation", /::equation\[/g],
  ["[@cite]", /\[@/g],
  ["[[wikilink]]", /\[\[/g],
];

describe("real guide draft corpus", () => {
  const files = collectDrafts(GUIDE);

  it("found draft files", () => expect(files.length).toBeGreaterThan(0));

  for (const file of files) {
    const rel = file.slice(GUIDE.length + 1);
    const src = readFileSync(file, "utf8");

    it(`preserves custom-token counts: ${rel}`, () => {
      const out = roundtrip(src);
      for (const [name, re] of PATTERNS) {
        const inCount = (src.match(re) ?? []).length;
        const outCount = (out.match(re) ?? []).length;
        expect(outCount, `${name} count in ${rel}`).toBe(inCount);
      }
    });

    it(`is idempotent: ${rel}`, () => {
      const once = roundtrip(src);
      expect(roundtrip(once)).toBe(once);
    });
  }
});
