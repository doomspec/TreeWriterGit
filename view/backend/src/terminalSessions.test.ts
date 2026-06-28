import { describe, expect, it, vi } from "vitest";

import { createTerminalSessionManager, parseTerminalConnectParams } from "./terminalSessions.js";

describe("parseTerminalConnectParams", () => {
  it("reads session id and new flag from websocket path", () => {
    expect(parseTerminalConnectParams("/terminal?session=abc&new=1")).toEqual({
      sessionId: "abc",
      forceNew: true,
      replayScrollback: true,
    });
  });

  it("defaults when params are absent", () => {
    expect(parseTerminalConnectParams("/terminal")).toEqual({
      sessionId: null,
      forceNew: false,
      replayScrollback: true,
    });
  });

  it("skips full scrollback replay when scrollback=0", () => {
    expect(parseTerminalConnectParams("/terminal?session=abc&scrollback=0")).toEqual({
      sessionId: "abc",
      forceNew: false,
      replayScrollback: false,
    });
  });
});

describe("createTerminalSessionManager", () => {
  it("reattaches to an existing session and replays scrollback", async () => {
    const manager = createTerminalSessionManager({
      command: "cat",
      args: [],
      cwd: process.cwd(),
    });

    const session = manager.resolveSession("persist-test", false);
    manager.handleInput(session, "hello");

    await new Promise((resolve) => setTimeout(resolve, 50));
    manager.detach(session);

    const reattached = manager.resolveSession("persist-test", false);
    expect(reattached).toBe(session);
    expect(reattached.scrollback).toContain("hello");
  });

  it("sends only disconnect gap when scrollback replay is skipped", async () => {
    const manager = createTerminalSessionManager({
      command: "cat",
      args: [],
      cwd: process.cwd(),
    });

    const session = manager.resolveSession("resume-test", false);
    manager.handleInput(session, "before");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const firstSocket = {
      readyState: 1,
      send: vi.fn(),
    } as unknown as import("ws").WebSocket;
    manager.attach(firstSocket, session);
    expect(firstSocket.send).toHaveBeenCalledWith("before");

    manager.detach(session);
    manager.handleInput(session, "after");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const secondSocket = {
      readyState: 1,
      send: vi.fn(),
    } as unknown as import("ws").WebSocket;
    manager.attach(secondSocket, session, { replayScrollback: false });
    expect(secondSocket.send).toHaveBeenCalledWith("after");
    expect(secondSocket.send).not.toHaveBeenCalledWith("beforeafter");
  });

  it("starts a new session when forceNew is set", async () => {
    const manager = createTerminalSessionManager({
      command: "cat",
      args: [],
      cwd: process.cwd(),
    });

    const first = manager.resolveSession("replace-me", false);
    manager.handleInput(first, "old");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = manager.resolveSession("replace-me", true);
    expect(second).not.toBe(first);
    expect(second.id).not.toBe(first.id);
  });
});
