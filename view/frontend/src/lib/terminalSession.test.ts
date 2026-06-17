import { describe, expect, it } from "vitest";

import {
  buildTerminalWebSocketUrl,
  parseTerminalSessionMessage,
} from "./terminalSession";

describe("terminalSession", () => {
  it("builds websocket url with session params", () => {
    expect(
      buildTerminalWebSocketUrl("ws://localhost:4000/terminal", {
        sessionId: "abc-123",
        forceNew: false,
      }),
    ).toBe("ws://localhost:4000/terminal?session=abc-123");
  });

  it("parses session handshake messages", () => {
    expect(parseTerminalSessionMessage('{"type":"session","id":"abc-123"}')).toBe("abc-123");
    expect(parseTerminalSessionMessage("hello")).toBeNull();
  });
});
