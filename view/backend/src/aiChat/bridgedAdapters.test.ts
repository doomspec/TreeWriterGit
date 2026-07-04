import { describe, expect, it } from "vitest";
import { parseClaudeOutput, parseCodexOutput, parseGeminiOutput } from "./bridgedAdapters.js";

// Fixtures below are real captured output from the installed CLIs (2026-07-02),
// not hand-written approximations — see plans/ai-assistant-panel.md Stage 6.

describe("parseClaudeOutput", () => {
  it("extracts the reply text and session id from a successful turn", () => {
    const stdout = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "OK",
      session_id: "be0dcc11-b402-4b47-a302-e80b673cf33f",
    });
    expect(parseClaudeOutput(stdout)).toEqual({
      text: "OK",
      sessionId: "be0dcc11-b402-4b47-a302-e80b673cf33f",
    });
  });

  it("still surfaces the error message as text when is_error is true", () => {
    const stdout = JSON.stringify({
      type: "result",
      is_error: true,
      api_error_status: 401,
      result: "Failed to authenticate. API Error: 401 Invalid authentication credentials",
      session_id: "be0dcc11-b402-4b47-a302-e80b673cf33f",
    });
    expect(parseClaudeOutput(stdout).text).toBe(
      "Failed to authenticate. API Error: 401 Invalid authentication credentials",
    );
  });
});

describe("parseCodexOutput", () => {
  it("extracts the agent message and thread id, ignoring stderr-style noise lines", () => {
    const stdout = [
      "Reading additional input from stdin...",
      '{"type":"thread.started","thread_id":"019f22bd-3f45-71a3-881c-a2f9f193ed3d"}',
      '{"type":"turn.started"}',
      '2026-07-02T12:10:55.885858Z ERROR rmcp::transport::worker: worker quit with fatal',
      '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"OK"}}',
      '{"type":"turn.completed","usage":{"input_tokens":18928}}',
    ].join("\n");
    expect(parseCodexOutput(stdout)).toEqual({
      text: "OK",
      sessionId: "019f22bd-3f45-71a3-881c-a2f9f193ed3d",
    });
  });

  it("joins multiple agent_message items and returns null session id when absent", () => {
    const stdout = [
      '{"type":"item.completed","item":{"type":"agent_message","text":"First part."}}',
      '{"type":"item.completed","item":{"type":"reasoning","text":"ignored"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"Second part."}}',
    ].join("\n");
    expect(parseCodexOutput(stdout)).toEqual({
      text: "First part.\n\nSecond part.",
      sessionId: null,
    });
  });
});

describe("parseGeminiOutput", () => {
  it("extracts the assistant content and session id", () => {
    const stdout = [
      "Warning: 256-color support not detected.",
      '{"type":"init","timestamp":"2026-07-02T12:10:10.429Z","session_id":"0be58c10-4224-41b7-ae22-85005aa9381c","model":"auto"}',
      '{"type":"message","timestamp":"2026-07-02T12:10:10.432Z","role":"user","content":"Reply with exactly: OK"}',
      '{"type":"message","timestamp":"2026-07-02T12:10:20.958Z","role":"assistant","content":"OK","delta":true}',
      '{"type":"result","timestamp":"2026-07-02T12:10:21.130Z","status":"success"}',
    ].join("\n");
    expect(parseGeminiOutput(stdout)).toEqual({
      text: "OK",
      sessionId: "0be58c10-4224-41b7-ae22-85005aa9381c",
    });
  });

  it("ignores the echoed user message and concatenates multiple assistant chunks", () => {
    const stdout = [
      '{"type":"init","session_id":"abc"}',
      '{"type":"message","role":"user","content":"ignored"}',
      '{"type":"message","role":"assistant","content":"Hel"}',
      '{"type":"message","role":"assistant","content":"lo"}',
    ].join("\n");
    expect(parseGeminiOutput(stdout)).toEqual({ text: "Hello", sessionId: "abc" });
  });
});
