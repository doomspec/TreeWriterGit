/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useBridgedChatSession } from "./useBridgedChatSession";
import * as sessionClient from "@/lib/aiChat/sessionClient";
import * as bridgedChatClient from "@/lib/aiChat/bridgedChatClient";

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useBridgedChatSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches instantly (no network call) and lazily creates the trace on first send", async () => {
    const runTurnSpy = vi
      .spyOn(bridgedChatClient, "runBridgedTurn")
      .mockResolvedValue({ text: "PONG", sessionId: "sess-1" });
    const createSpy = vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "gemini",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    const appendSpy = vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      result.current.attach("gemini");
    });

    expect(result.current.status).toBe("attached");
    expect(createSpy).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.send("ping");
    });

    expect(runTurnSpy).toHaveBeenCalledWith(
      "gemini",
      "ping",
      null,
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    // The trace is created after the turn resolves, so it already carries
    // the CLI's own session id captured from that first reply.
    expect(createSpy).toHaveBeenCalledWith("papers/demo/1-intro", {
      provider: "gemini",
      mode: "bridged",
      agentSessionId: "sess-1",
    });
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0]).toMatchObject({ role: "user", text: "ping" });
    expect(result.current.turns[1]).toMatchObject({ role: "assistant", text: "PONG" });
    expect(result.current.status).toBe("attached");

    await flushMicrotasks();
    expect(appendSpy).toHaveBeenCalledTimes(2);
  });

  it("passes the captured session id back on the next turn for continuity", async () => {
    const runTurnSpy = vi
      .spyOn(bridgedChatClient, "runBridgedTurn")
      .mockResolvedValueOnce({ text: "NOTED", sessionId: "sess-42" })
      .mockResolvedValueOnce({ text: "ZEBRA-42", sessionId: "sess-42" });
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "gemini",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      result.current.attach("gemini");
    });
    await act(async () => {
      await result.current.send("Remember ZEBRA-42");
    });
    await act(async () => {
      await result.current.send("What was the codeword?");
    });

    expect(runTurnSpy).toHaveBeenNthCalledWith(
      1,
      "gemini",
      "Remember ZEBRA-42",
      null,
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    expect(runTurnSpy).toHaveBeenNthCalledWith(
      2,
      "gemini",
      "What was the codeword?",
      "sess-42",
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    expect(result.current.turns.at(-1)).toMatchObject({ role: "assistant", text: "ZEBRA-42" });
  });

  it("surfaces a provider error as the status without crashing", async () => {
    vi.spyOn(bridgedChatClient, "runBridgedTurn").mockRejectedValue(new Error("codex timed out"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro", onError }),
    );

    act(() => {
      result.current.attach("codex");
    });
    await act(async () => {
      await result.current.send("hello");
    });

    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalledWith("codex timed out");
  });

  it("forwards attached context paths to the bridged turn and records them on the trace (Stage 5)", async () => {
    const runTurnSpy = vi
      .spyOn(bridgedChatClient, "runBridgedTurn")
      .mockResolvedValue({ text: "PONG", sessionId: "sess-1" });
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "gemini",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });
    const contextSpy = vi
      .spyOn(sessionClient, "addChatSessionContextFiles")
      .mockResolvedValue({ ok: true, contextFiles: ["papers/demo/1-intro/draft.md"] });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      result.current.attach("gemini");
    });
    await act(async () => {
      await result.current.send("ping", ["papers/demo/1-intro/draft.md"]);
    });

    expect(runTurnSpy).toHaveBeenCalledWith(
      "gemini",
      "ping",
      null,
      ["papers/demo/1-intro/draft.md"],
      "papers/demo/1-intro",
      undefined,
    );
    // The visible/persisted turn text stays clean — attachment injection happens
    // server-side, not in the trace.
    expect(result.current.turns[0]).toMatchObject({ role: "user", text: "ping" });
    expect(contextSpy).toHaveBeenCalledWith("papers/demo/1-intro", "chat-1.md", [
      "papers/demo/1-intro/draft.md",
    ]);
  });

  it("resume restores turns, agent session id, and reuses the trace file", async () => {
    const sessionFile = {
      provider: "codex",
      mode: "bridged" as const,
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      agentSessionId: "sess-resume",
      id: "1",
      filename: "chat-resume.md",
      wikiPath: "papers/demo/notes/sessions/chat-resume.md",
      turns: [
        { role: "user" as const, text: "Earlier question", at: "2026-07-02T09:00:05.000Z" },
        { role: "assistant" as const, text: "Earlier answer", at: "2026-07-02T09:00:10.000Z" },
      ],
    };
    const runTurnSpy = vi
      .spyOn(bridgedChatClient, "runBridgedTurn")
      .mockResolvedValue({ text: "Follow-up", sessionId: "sess-resume" });
    const createSpy = vi.spyOn(sessionClient, "createChatSession");
    const appendSpy = vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      expect(result.current.resume(sessionFile)).toBe(true);
    });

    expect(result.current.status).toBe("attached");
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.provider).toBe("codex");

    await act(async () => {
      await result.current.send("Next question");
    });

    expect(runTurnSpy).toHaveBeenCalledWith(
      "codex",
      "Next question",
      "sess-resume",
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    expect(createSpy).not.toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith("papers/demo/1-intro", "chat-resume.md", expect.any(Object));
    expect(result.current.turns).toHaveLength(4);
  });

  it("retries without session id when resume fails with an expired session error", async () => {
    const runTurnSpy = vi
      .spyOn(bridgedChatClient, "runBridgedTurn")
      .mockRejectedValueOnce(new Error("session expired"))
      .mockResolvedValueOnce({ text: "Fresh start", sessionId: "sess-new" });
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "codex",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      result.current.resume({
        provider: "codex",
        mode: "bridged",
        startedAt: "2026-07-02T09:00:00.000Z",
        unitPath: "papers/demo/1-intro",
        agentSessionId: "sess-stale",
        id: "1",
        filename: "chat-1.md",
        wikiPath: "papers/demo/notes/sessions/chat-1.md",
        turns: [{ role: "user", text: "Hi", at: "2026-07-02T09:00:05.000Z" }],
      });
    });

    await act(async () => {
      await result.current.send("Continue please");
    });

    expect(runTurnSpy).toHaveBeenNthCalledWith(
      1,
      "codex",
      "Continue please",
      "sess-stale",
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    expect(runTurnSpy).toHaveBeenNthCalledWith(
      2,
      "codex",
      "Continue please",
      null,
      undefined,
      "papers/demo/1-intro",
      undefined,
    );
    expect(result.current.resumeNotice).toContain("expired");
    expect(result.current.status).toBe("attached");
  });

  it("detach resets provider, turns, and the trace session", async () => {
    vi.spyOn(bridgedChatClient, "runBridgedTurn").mockResolvedValue({
      text: "PONG",
      sessionId: "sess-1",
    });
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "hermes",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBridgedChatSession({ unitPath: "papers/demo/1-intro" }),
    );

    act(() => {
      result.current.attach("hermes");
    });
    await act(async () => {
      await result.current.send("ping");
    });

    act(() => {
      result.current.detach();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.turns).toEqual([]);
    expect(result.current.provider).toBe("unknown");
  });
});
