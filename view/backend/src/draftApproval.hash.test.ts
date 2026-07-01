import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { approveDraftTarget, readDraftEditMeta } from "./draftApproval.js";
import { manuscriptContentHash } from "./draftApproval/hash.js";
import { createNode } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-approval-hash-"));
  await createNode(modelRoot, "papers", "demo", "section");
  await createNode(modelRoot, "papers/demo", "unit-a", "unit");
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("approval hash metadata", () => {
  it("stores content hash and approvers in .approval/draft.yaml", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const body = "Final text.\n";
    await writeFile(path.join(modelRoot, draftRel), body, "utf8");
    await approveDraftTarget(modelRoot, draftRel, "reviewer");

    const yaml = await readFile(
      path.join(modelRoot, "papers/demo/unit-a/.approval/draft.yaml"),
      "utf8",
    );
    expect(yaml).toContain(`content_hash: ${JSON.stringify(manuscriptContentHash(body))}`);
    expect(yaml).toContain('approved_by: "reviewer"');
    expect(yaml).toContain('- "reviewer"');

    const meta = await readDraftEditMeta(modelRoot, "papers/demo/unit-a");
    expect(meta.approvers).toEqual(["reviewer"]);
    expect(meta.contentHash).toBe(manuscriptContentHash(body));
  });

  it("ignores text highlight edits for pending detection", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const body = "Final text.\n";
    await writeFile(path.join(modelRoot, draftRel), body, "utf8");
    await approveDraftTarget(modelRoot, draftRel, "reviewer");
    await writeFile(
      path.join(modelRoot, draftRel),
      "Final \\hl{yellow}{text}.\n",
      "utf8",
    );
    const { draftsMatchApproved } = await import("./draftApproval/paths.js");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(true);
  });

  it("ignores inline comment edits for pending detection", async () => {
    const draftRel = "papers/demo/unit-a/draft.md";
    const body = "Final text.\n";
    await writeFile(path.join(modelRoot, draftRel), body, "utf8");
    await approveDraftTarget(modelRoot, draftRel, "reviewer");
    await writeFile(
      path.join(modelRoot, draftRel),
      `${body.trim()} <comment id="x" author="iy">note</comment>\n`,
      "utf8",
    );
    const { draftsMatchApproved } = await import("./draftApproval/paths.js");
    expect(await draftsMatchApproved(modelRoot, "papers/demo/unit-a")).toBe(true);
  });
});
