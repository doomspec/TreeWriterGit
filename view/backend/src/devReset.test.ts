import { describe, expect, it } from "vitest";

import { createTerminalSessionManager } from "./terminalSessions.js";
import { resetServerMemoryState } from "./devReset.js";

describe("resetServerMemoryState", () => {
  it("clears terminal sessions when manager is provided", () => {
    const terminalSessions = createTerminalSessionManager({
      command: "sleep",
      args: ["30"],
      cwd: process.cwd(),
    });
    terminalSessions.resolveSession("test-session", true);
    expect(terminalSessions._sessions.size).toBe(1);

    const result = resetServerMemoryState({ terminalSessions });
    expect(result.terminalSessionsCleared).toBe(true);
    expect(terminalSessions._sessions.size).toBe(0);
  });
});
