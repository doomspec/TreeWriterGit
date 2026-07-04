import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeModelPath,
  cmdContext,
  cmdHealth,
  cmdRead,
  cmdSessions,
  normalizeModelPath,
  paperSlugFromPath,
} from "./tw-context.mjs";

describe("tw-context path helpers", () => {
  it("normalizes slashes and trims", () => {
    assert.equal(normalizeModelPath("\\papers\\demo\\"), "papers/demo");
  });

  it("rejects unsafe paths", () => {
    assert.throws(() => assertSafeModelPath("../etc/passwd"), /Unsafe path/);
    assert.throws(() => assertSafeModelPath(""), /Unsafe path/);
  });

  it("extracts paper slug", () => {
    assert.equal(paperSlugFromPath("papers/demo/intro/unit"), "demo");
    assert.equal(paperSlugFromPath("literature/foo"), null);
  });
});

describe("tw-context read", () => {
  let modelRoot;

  before(() => {
    modelRoot = mkdtempSync(path.join(tmpdir(), "tw-context-read-"));
    const unitDir = path.join(modelRoot, "papers", "demo", "unit-a");
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(path.join(unitDir, "draft.md"), "Hello draft.\n");
  });

  it("reads a model file", () => {
    const content = cmdRead("papers/demo/unit-a/draft.md", { json: false }, modelRoot);
    assert.equal(content, "Hello draft.\n");
  });

  it("returns json shape when --json", () => {
    const data = cmdRead("papers/demo/unit-a/draft.md", { json: true }, modelRoot);
    assert.deepEqual(data, { path: "papers/demo/unit-a/draft.md", content: "Hello draft.\n" });
  });
});

describe("tw-context sessions", () => {
  let modelRoot;

  before(() => {
    modelRoot = mkdtempSync(path.join(tmpdir(), "tw-context-sessions-"));
    const chatDir = path.join(modelRoot, "papers", "demo", "notes", "sessions");
    const dispatchDir = path.join(modelRoot, "papers", "demo", "intro", ".sessions");
    mkdirSync(chatDir, { recursive: true });
    mkdirSync(dispatchDir, { recursive: true });
    writeFileSync(path.join(chatDir, "chat-2026-01-01.md"), "# chat\n");
    writeFileSync(path.join(dispatchDir, "2026-01-01T12-00-00.md"), "# dispatch\n");
  });

  it("lists chat and dispatch session files", () => {
    const data = cmdSessions("papers/demo", { json: true, kind: "all" }, modelRoot);
    assert.equal(data.paper, "papers/demo");
    assert.ok(data.sessions.some((p) => p.includes("notes/sessions/chat-")));
    assert.ok(data.sessions.some((p) => p.includes(".sessions/")));
  });

  it("filters by kind", () => {
    const chatOnly = cmdSessions("papers/demo", { json: true, kind: "chat" }, modelRoot);
    assert.ok(chatOnly.sessions.every((p) => p.includes("/notes/sessions/")));
  });
});

describe("tw-context API commands", () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("cmdHealth returns ok text", async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ status: "ok" }),
    }));
    const result = await cmdHealth({ json: false, api: "http://localhost:4000" });
    assert.equal(result, "ok");
  });

  it("cmdContext formats file checklist", async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        files: [{ path: "papers/demo/u/draft.md", category: "unit", label: "Draft", defaultIncluded: true }],
      }),
    }));
    const text = await cmdContext("papers/demo/u", { json: false, api: "http://localhost:4000", action: "draft" });
    assert.match(text, /draft\.md/);
    assert.match(text, /unit/);
  });
});
