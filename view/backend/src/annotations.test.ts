import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createComment } from "./comments.js";
import { listAnnotationsUnderPath } from "./annotations.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-annot-"));
  await mkdir(path.join(modelRoot, "papers/demo/sections/intro/units/a"), { recursive: true });
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("listAnnotationsUnderPath", () => {
  it("returns comments and inline notes sorted by file and line", async () => {
    const draftPath = "papers/demo/sections/intro/units/a/draft.md";
    await writeFile(
      path.join(modelRoot, draftPath),
      "# Draft\n\nClaim \\iy{needs cite} here.\nSecond \\ak{fix tone} line.\n",
      "utf8",
    );
    await createComment(modelRoot, draftPath, {
      line: 3,
      author: "Ada",
      text: "Check citation",
    });

    const items = await listAnnotationsUnderPath(modelRoot, "papers/demo/sections/intro");
    expect(items).toHaveLength(3);
    expect(items[0].type).toBe("comment");
    expect(items[0].text).toBe("Check citation");
    expect(items[1].type).toBe("inlineNote");
    expect(items[1].author).toBe("iy");
    expect(items[2].type).toBe("inlineNote");
    expect(items[2].author).toBe("ak");
  });
});
