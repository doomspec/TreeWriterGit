import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import {
  addChatSessionContextFiles,
  appendChatTurn,
  createChatSession,
  listChatSessions,
  readChatSession,
} from "./chatSessions.js";
import { ModelFsError } from "./modelFs.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-chat-sessions-"));
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
}

describe("chat session path safety", () => {
  it("rejects traversal in unitPath on create", async () => {
    await expect(
      createChatSession(modelRoot, "../escape", { provider: "claude", mode: "pty" }),
    ).rejects.toBeInstanceOf(ModelFsError);
  });

  it("rejects traversal in unitPath on list", async () => {
    await expect(listChatSessions(modelRoot, "../escape")).rejects.toBeInstanceOf(ModelFsError);
  });

  it("rejects a filename that escapes the sessions directory", async () => {
    await seedUnit("papers/demo/1-intro");
    await expect(
      appendChatTurn(modelRoot, "papers/demo/1-intro", "../../../etc/passwd", {
        role: "user",
        text: "hi",
        at: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ModelFsError);
  });

  it("rejects a filename outside the chat- naming convention", async () => {
    await seedUnit("papers/demo/1-intro");
    await expect(
      appendChatTurn(modelRoot, "papers/demo/1-intro", "2026-07-02.md", {
        role: "user",
        text: "hi",
        at: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ModelFsError);
  });
});

describe("chat session lifecycle", () => {
  it("creates a session file with frontmatter and no turns", async () => {
    await seedUnit("papers/demo/1-intro");
    const created = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "claude",
      mode: "pty",
      terminalSessionId: "term-1",
    });

    expect(created.provider).toBe("claude");
    expect(created.mode).toBe("pty");
    expect(created.terminalSessionId).toBe("term-1");
    expect(created.turns).toEqual([]);
    expect(created.wikiPath).toBe(`papers/demo/notes/sessions/${created.filename}`);
  });

  it("appends turns and reads them back in order", async () => {
    await seedUnit("papers/demo/1-intro");
    const created = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "hermes",
      mode: "pty",
    });

    await appendChatTurn(modelRoot, "papers/demo/1-intro", created.filename, {
      role: "user",
      text: "Rewrite the intro paragraph.",
      at: "2026-07-02T09:15:12.000Z",
    });
    await appendChatTurn(modelRoot, "papers/demo/1-intro", created.filename, {
      role: "assistant",
      text: "Done — tightened the opening sentence.",
      at: "2026-07-02T09:15:40.000Z",
    });

    const read = await readChatSession(modelRoot, "papers/demo/1-intro", created.filename);
    expect(read.turns).toHaveLength(2);
    expect(read.turns[0]).toMatchObject({ role: "user", text: "Rewrite the intro paragraph." });
    expect(read.turns[1]).toMatchObject({
      role: "assistant",
      text: "Done — tightened the opening sentence.",
    });
    // Turn order is preserved and each turn keeps its own timestamp.
    expect(read.turns[0].at).not.toBe(read.turns[1].at);
  });

  it("preserves multi-line turn text", async () => {
    await seedUnit("papers/demo/1-intro");
    const created = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "codex",
      mode: "pty",
    });
    const multiline = "Line one.\nLine two.\n\nLine four after a blank line.";
    await appendChatTurn(modelRoot, "papers/demo/1-intro", created.filename, {
      role: "assistant",
      text: multiline,
      at: new Date().toISOString(),
    });

    const read = await readChatSession(modelRoot, "papers/demo/1-intro", created.filename);
    expect(read.turns[0].text).toBe(multiline);
  });

  it("throws when appending to a session that does not exist", async () => {
    await seedUnit("papers/demo/1-intro");
    await expect(
      appendChatTurn(modelRoot, "papers/demo/1-intro", "chat-missing.md", {
        role: "user",
        text: "hi",
        at: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ModelFsError);
  });

  it("lists sessions newest-first with turn counts and skips non-chat files", async () => {
    await seedUnit("papers/demo/1-intro");
    const first = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "claude",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
    });
    await appendChatTurn(modelRoot, "papers/demo/1-intro", first.filename, {
      role: "user",
      text: "hi",
      at: "2026-07-02T09:00:05.000Z",
    });
    const second = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "gemini",
      mode: "bridged",
      startedAt: "2026-07-02T10:00:00.000Z",
    });

    // A dispatch-style day file sitting in the same folder must be ignored.
    const dir = path.join(modelRoot, "papers/demo/notes/sessions");
    await writeFile(
      path.join(dir, "2026-07-02.md"),
      matter.stringify("# AI dispatch log\n", { kind: "llm-wiki-day" }),
      "utf8",
    );

    const sessions = await listChatSessions(modelRoot, "papers/demo/1-intro");
    expect(sessions.map((s) => s.filename)).toEqual([second.filename, first.filename]);
    expect(sessions[1].turnCount).toBe(1);
    expect(sessions[0].turnCount).toBe(0);
    expect(sessions[1].lastAt).toBe("2026-07-02T09:00:05.000Z".slice(11, 19));
  });
});

describe("attach-files context recording (Stage 5)", () => {
  it("records contextFiles at creation and unions new paths across sends", async () => {
    await seedUnit("papers/demo/1-intro");
    const created = await createChatSession(modelRoot, "papers/demo/1-intro", {
      provider: "gemini",
      mode: "bridged",
      contextFiles: ["papers/demo/1-intro/outline.md"],
    });
    expect(created.contextFiles).toEqual(["papers/demo/1-intro/outline.md"]);

    const merged = await addChatSessionContextFiles(
      modelRoot,
      "papers/demo/1-intro",
      created.filename,
      ["papers/demo/1-intro/draft.md", "papers/demo/1-intro/outline.md"],
    );
    // Re-attaching an already-recorded path does not duplicate it.
    expect(merged).toEqual(["papers/demo/1-intro/outline.md", "papers/demo/1-intro/draft.md"]);

    const read = await readChatSession(modelRoot, "papers/demo/1-intro", created.filename);
    expect(read.contextFiles).toEqual(merged);
  });

  it("throws when recording context files against a missing session", async () => {
    await seedUnit("papers/demo/1-intro");
    await expect(
      addChatSessionContextFiles(modelRoot, "papers/demo/1-intro", "chat-missing.md", [
        "papers/demo/1-intro/draft.md",
      ]),
    ).rejects.toBeInstanceOf(ModelFsError);
  });
});
