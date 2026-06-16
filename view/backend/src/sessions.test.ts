import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import {
  advanceUnitStatusOnSessionComplete,
  createSession,
  listSessions,
  updateSessionStatus,
} from "./sessions.js";
import { ModelFsError } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-sessions-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

async function seedUnit(unitRel: string) {
  const abs = path.join(modelRoot, unitRel);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    matter.stringify("", { kind: "unit", title: "Unit", status: "outline" }),
    "utf8",
  );
  await writeFile(path.join(abs, "outline.md"), "# Unit\n\n", "utf8");
  await writeFile(path.join(abs, "draft.md"), "", "utf8");
}

describe("sessions path safety", () => {
  it("rejects traversal in unitPath on list", async () => {
    await expect(listSessions(modelRoot, "../escape")).rejects.toBeInstanceOf(ModelFsError);
  });

  it("rejects invalid session filename on patch", async () => {
    await seedUnit("papers/ml/unit-a");
    await createSession(modelRoot, "papers/ml/unit-a", {
      at: new Date().toISOString(),
      provider: "Claude",
      action: "draft",
      command: "echo",
      status: "dispatched",
    });
    await expect(
      updateSessionStatus(modelRoot, "papers/ml/unit-a", "../../evil.md", "complete"),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("advanceUnitStatusOnSessionComplete", () => {
  it("bumps unit status to drafted after draft session completes", async () => {
    await seedUnit("papers/ml/unit-a");
    await advanceUnitStatusOnSessionComplete(modelRoot, "papers/ml/unit-a", "draft");
    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(modelRoot, "papers/ml/unit-a/INDEX.md"), "utf8"),
    );
    const data = matter(raw).data as Record<string, unknown>;
    expect(data.status).toBe("drafted");
  });
});
