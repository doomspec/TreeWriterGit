import { describe, expect, it } from "vitest";

import { createTerminalSessionManager, parseTerminalConnectParams } from "./terminalSessions.js";

describe("parseTerminalConnectParams", () => {
  it("reads session id and new flag from websocket path", () => {
    expect(parseTerminalConnectParams("/terminal?session=abc&new=1")).toEqual({
      sessionId: "abc",
      forceNew: true,
    });
  });

  it("defaults when params are absent", () => {
    expect(parseTerminalConnectParams("/terminal")).toEqual({
      sessionId: null,
      forceNew: false,
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
