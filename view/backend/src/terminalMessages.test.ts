import { describe, expect, it } from "vitest";

import { clampTerminalSize, parseTerminalClientMessage } from "./terminalMessages.js";

describe("parseTerminalClientMessage", () => {
  it("accepts valid input", () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: "input", data: "ls\n" }))).toEqual({
      type: "input",
      data: "ls\n",
    });
  });

  it("rejects non-string input data", () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: "input", data: 1 }))).toBeNull();
  });

  it("accepts clamped resize within bounds", () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: "resize", cols: 80, rows: 24 }))).toEqual({
      type: "resize",
      cols: 80,
      rows: 24,
    });
  });

  it("rejects out-of-range resize", () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: "resize", cols: 9999, rows: 24 }))).toBeNull();
  });
});

describe("clampTerminalSize", () => {
  it("rounds and validates dimensions", () => {
    expect(clampTerminalSize(80.4, 24.6)).toEqual({ cols: 80, rows: 25 });
  });
});
