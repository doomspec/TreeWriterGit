import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

describe("session wiki storage", () => {
  it("appends dispatch history to a daily llm-wiki file under notes/sessions", async () => {
    await seedUnit("papers/vibecount/results/expert_concordance");
    const at = "2026-06-23T04:35:14.886Z";
    const wikiPath = await createSession(modelRoot, "papers/vibecount/results/expert_concordance", {
      at,
      provider: "Gemini",
      action: "draft",
      command: "gemini -p test",
      status: "dispatched",
    });

    expect(wikiPath).toBe("papers/vibecount/notes/sessions/2026-06-23.md");
    const raw = await readFile(path.join(modelRoot, wikiPath), "utf8");
    const parsed = matter(raw);
    expect(parsed.data.kind).toBe("llm-wiki-day");
    expect(parsed.data.date).toBe("2026-06-23");
    expect(parsed.content).toContain("<!-- tw-session");
    expect(parsed.content).toContain("unit: papers/vibecount/results/expert_concordance");
    expect(parsed.content).toContain("gemini -p test");

    const sessions = await listSessions(modelRoot, "papers/vibecount/results/expert_concordance");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("dispatched");
    expect(sessions[0]?.provider).toBe("Gemini");
  });

  it("appends multiple sessions to the same daily file", async () => {
    await seedUnit("papers/vibecount/abstract");
    await createSession(modelRoot, "papers/vibecount/abstract", {
      at: "2026-06-23T01:00:00.000Z",
      provider: "Codex",
      action: "draft",
      command: "codex draft",
      status: "complete",
    });
    await createSession(modelRoot, "papers/vibecount/abstract", {
      at: "2026-06-23T03:00:00.000Z",
      provider: "Gemini",
      action: "revise",
      command: "gemini revise",
      status: "dispatched",
    });

    const sessions = await listSessions(modelRoot, "papers/vibecount/abstract");
    expect(sessions).toHaveLength(2);
    const raw = await readFile(
      path.join(modelRoot, "papers/vibecount/notes/sessions/2026-06-23.md"),
      "utf8",
    );
    expect(raw.match(/<!-- tw-session/g)?.length).toBe(2);
  });

  it("updates session status inside the daily wiki file", async () => {
    await seedUnit("papers/vibecount/abstract");
    await createSession(modelRoot, "papers/vibecount/abstract", {
      at: "2026-06-23T03:00:00.000Z",
      provider: "Gemini",
      action: "revise",
      command: "gemini revise",
      status: "dispatched",
    });
    const [session] = await listSessions(modelRoot, "papers/vibecount/abstract");
    expect(session?.filename).toBeTruthy();
    await updateSessionStatus(
      modelRoot,
      "papers/vibecount/abstract",
      session!.filename,
      "complete",
    );
    const [updated] = await listSessions(modelRoot, "papers/vibecount/abstract");
    expect(updated?.status).toBe("complete");
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
