/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/** Flush pending microtasks (promise .then/.catch chains) under fake timers. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

import { usePtyChatSession } from "./usePtyChatSession";
import * as sessionClient from "@/lib/aiChat/sessionClient";

function makeHarness() {
  const listeners = new Set<(chunk: string) => void>();
  const sent: string[] = [];
  const subscribeOutput = vi.fn((listener: (chunk: string) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  const emit = (chunk: string) => {
    for (const listener of listeners) listener(chunk);
  };
  const onSendToTerminal = vi.fn((text: string) => sent.push(text));
  const onError = vi.fn();

  return { subscribeOutput, emit, onSendToTerminal, onError, sent };
}

describe("usePtyChatSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("attaches, creating a session with the guessed provider", async () => {
    const h = makeHarness();
    const createSpy = vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "claude",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => "term-1",
        getLastInputLine: () => "claude --model sonnet",
        onError: h.onError,
      }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.suggestedProvider).toBe("claude");

    await act(async () => {
      await result.current.attach();
    });

    expect(createSpy).toHaveBeenCalledWith("papers/demo/1-intro", {
      provider: "claude",
      mode: "pty",
      terminalSessionId: "term-1",
    });
    expect(result.current.status).toBe("attached");
    expect(result.current.provider).toBe("claude");
    // The guessed provider matches what's already typed in the terminal —
    // must not relaunch/retype into a session the user already started.
    expect(h.onSendToTerminal).not.toHaveBeenCalled();
  });

  it("auto-launches a chosen provider that isn't already running", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "gemini",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "", // nothing typed yet
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach("gemini");
    });

    expect(h.sent).toEqual(["gemini\r"]);
    expect(result.current.status).toBe("attached");
  });

  it("does not relaunch when choosing 'unknown' (the user's own already-running session)", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "unknown",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "codex --sandbox danger-full-access",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach("unknown");
    });

    expect(h.onSendToTerminal).not.toHaveBeenCalled();
    expect(result.current.status).toBe("attached");
  });

  it("sends a turn, captures the reply after the quiet period, and persists both turns", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "hermes",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    const appendSpy = vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach("hermes");
    });

    // Attaching a known provider that isn't already running launches it.
    expect(h.sent).toEqual(["hermes\r"]);

    act(() => {
      result.current.send("Rewrite the intro paragraph.");
    });

    // The first message of a session is prefixed with a context line naming
    // the unit, so the CLI doesn't have to search the repo for the right file.
    const expectedOutgoing =
      'Context: you are working in the TreeWriter unit "papers/demo/1-intro" ' +
      "(paths below are relative to the model/ root).\n\nRewrite the intro paragraph.";
    expect(h.sent).toEqual(["hermes\r", `${expectedOutgoing}\r`]);
    expect(result.current.status).toBe("capturing");
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0]).toMatchObject({
      role: "user",
      text: expectedOutgoing,
    });

    // Simulate the PTY echoing every line of what we typed, then the actual
    // reply arriving in a couple of chunks with ANSI noise.
    act(() => {
      for (const line of expectedOutgoing.split("\n")) h.emit(`${line}\r\n`);
      h.emit("\x1b[32mDone\x1b[0m — tightened ");
      h.emit("the opening sentence.\n");
    });

    expect(result.current.pendingText).toBe("Done — tightened the opening sentence.");

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.status).toBe("attached");
    expect(result.current.pendingText).toBe("");
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[1]).toMatchObject({
      role: "assistant",
      text: "Done — tightened the opening sentence.",
    });

    await flushMicrotasks();
    expect(appendSpy).toHaveBeenCalledTimes(2);
    expect(appendSpy).toHaveBeenNthCalledWith(
      1,
      "papers/demo/1-intro",
      "chat-1.md",
      expect.objectContaining({ role: "user", text: expectedOutgoing }),
    );
    expect(appendSpy).toHaveBeenNthCalledWith(
      2,
      "papers/demo/1-intro",
      "chat-1.md",
      expect.objectContaining({ role: "assistant", text: "Done — tightened the opening sentence." }),
    );
  });

  it("only prefixes the unit context line on the first message of a session, not later ones", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "hermes",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach("hermes");
    });

    act(() => {
      result.current.send("first message");
    });
    expect(result.current.turns[0].text).toContain('Context: you are working in the TreeWriter unit "papers/demo/1-intro"');

    act(() => {
      result.current.send("second message");
    });
    expect(result.current.turns[1].text).toBe("second message");

    // Re-attaching resets the "first message" state for the new session.
    act(() => {
      result.current.detach();
    });
    await act(async () => {
      await result.current.attach("hermes");
    });
    act(() => {
      result.current.send("third message, new session");
    });
    expect(result.current.turns[0].text).toContain("Context: you are working in the TreeWriter unit");
  });

  it("finalizes capture at the hard cap even if output never quiets", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "unknown",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach();
    });
    act(() => {
      result.current.send("stream forever");
    });

    // Keep the quiet timer from ever firing by emitting just under its window,
    // repeatedly, until the hard cap is reached.
    for (let elapsed = 0; elapsed < 60_000; elapsed += 700) {
      act(() => {
        h.emit("still going...");
        vi.advanceTimersByTime(700);
      });
    }

    expect(result.current.status).toBe("attached");
    expect(result.current.turns.at(-1)?.role).toBe("assistant");
  });

  it("stop() sends Ctrl+C and finalizes the in-flight capture", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "unknown",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [],
    });
    vi.spyOn(sessionClient, "appendChatTurn").mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach();
    });
    act(() => {
      result.current.send("long running thing");
      h.emit("partial output so far");
    });

    act(() => {
      result.current.stop();
    });

    expect(h.onSendToTerminal).toHaveBeenLastCalledWith("\x03");
    expect(result.current.status).toBe("attached");
    expect(result.current.turns.at(-1)).toMatchObject({
      role: "assistant",
      text: "partial output so far",
    });
  });

  it("prefixes the outgoing text with an @-mention block and records attached files (Stage 5)", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockResolvedValue({
      provider: "hermes",
      mode: "pty",
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
      .mockResolvedValue({ ok: true, contextFiles: ["papers/demo/1-intro/outline.md"] });

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach("hermes");
    });

    // A first, plain message to get the once-per-session context line out of
    // the way, so this test can focus on the attach-files prefix alone.
    act(() => {
      result.current.send("hi");
    });

    act(() => {
      result.current.send("Rewrite the intro paragraph.", ["papers/demo/1-intro/outline.md"]);
    });

    const expected =
      "Files:\n@papers/demo/1-intro/outline.md\n\nRewrite the intro paragraph.";
    expect(h.sent.at(-1)).toBe(`${expected}\r`);
    expect(result.current.turns[1]).toMatchObject({ role: "user", text: expected });

    await flushMicrotasks();
    expect(contextSpy).toHaveBeenCalledWith("papers/demo/1-intro", "chat-1.md", [
      "papers/demo/1-intro/outline.md",
    ]);
  });

  it("surfaces an error and stays idle when session creation fails", async () => {
    const h = makeHarness();
    vi.spyOn(sessionClient, "createChatSession").mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() =>
      usePtyChatSession({
        unitPath: "papers/demo/1-intro",
        connectionState: "connected",
        onSendToTerminal: h.onSendToTerminal,
        subscribeOutput: h.subscribeOutput,
        getTerminalSessionId: () => null,
        getLastInputLine: () => "",
        onError: h.onError,
      }),
    );

    await act(async () => {
      await result.current.attach();
    });

    expect(result.current.status).toBe("error");
    expect(h.onError).toHaveBeenCalledWith("network down");
  });
});
