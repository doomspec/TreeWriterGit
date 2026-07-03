import { spawn } from "node:child_process";

/**
 * Bridged chat mode (plans/ai-assistant-panel.md, Stage 6 — pulled forward):
 * per-turn headless invocation of a known agent CLI with session resume,
 * instead of scraping the interactive terminal. Full-screen TUI harnesses
 * (codex, claude, gemini) redraw their own UI over the PTY, which the PTY
 * chat lens (usePtyChatSession) can't parse reliably — bridged mode calls
 * each CLI's own non-interactive/JSON mode directly for a clean reply.
 *
 * Every argv is passed as an array to spawn() — never shell-interpolated —
 * so the prompt text can never break out of its own argument regardless of
 * its content.
 */

export type BridgedProvider = "claude" | "codex" | "gemini" | "hermes";

export type BridgedTurnResult = {
  text: string;
  sessionId: string | null;
};

const TURN_TIMEOUT_MS = 120_000;

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = TURN_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // stdin must not be a live, never-closed pipe: some CLIs (observed:
    // codex) treat an open stdin as an invitation to wait for piped input
    // before proceeding, hanging indefinitely. "ignore" gives them an
    // immediate EOF instead.
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

/** Parse `claude -p ... --output-format json` output (single JSON object). */
export function parseClaudeOutput(stdout: string): BridgedTurnResult {
  const parsed = JSON.parse(stdout.trim()) as {
    result?: string;
    session_id?: string;
    is_error?: boolean;
  };
  return {
    text: parsed.result ?? "",
    sessionId: parsed.session_id ?? null,
  };
}

type JsonlEvent = Record<string, unknown>;

function parseJsonl(stdout: string): JsonlEvent[] {
  const events: JsonlEvent[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed) as JsonlEvent);
    } catch {
      // skip non-JSON banner/log lines interleaved in stdout
    }
  }
  return events;
}

/** Parse `codex exec ... --json` output (JSONL events). */
export function parseCodexOutput(stdout: string): BridgedTurnResult {
  const events = parseJsonl(stdout);
  let sessionId: string | null = null;
  const messages: string[] = [];
  for (const event of events) {
    if (event.type === "thread.started" && typeof event.thread_id === "string") {
      sessionId = event.thread_id;
    }
    if (event.type === "item.completed") {
      const item = event.item as { type?: string; text?: string } | undefined;
      if (item?.type === "agent_message" && typeof item.text === "string") {
        messages.push(item.text);
      }
    }
  }
  return { text: messages.join("\n\n").trim(), sessionId };
}

/** Parse `gemini -p ... -o stream-json` output (JSONL events). */
export function parseGeminiOutput(stdout: string): BridgedTurnResult {
  const events = parseJsonl(stdout);
  let sessionId: string | null = null;
  const messages: string[] = [];
  for (const event of events) {
    if (event.type === "init" && typeof event.session_id === "string") {
      sessionId = event.session_id;
    }
    if (event.type === "message" && event.role === "assistant" && typeof event.content === "string") {
      messages.push(event.content);
    }
  }
  return { text: messages.join("").trim(), sessionId };
}

/** Best-effort scrape of the most recent hermes session id (no JSON output for `sessions list`). */
async function captureLatestHermesSessionId(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await runProcess("hermes", ["sessions", "list", "--limit", "1"], cwd);
    const lastLine = stdout.trim().split("\n").pop() ?? "";
    const tokens = lastLine.trim().split(/\s+/);
    const id = tokens[tokens.length - 1];
    return id && id !== "ID" ? id : null;
  } catch {
    return null;
  }
}

async function runHermesTurn(cwd: string, prompt: string, sessionId: string | null): Promise<BridgedTurnResult> {
  const args = ["-z", prompt];
  if (sessionId) args.push("--resume", sessionId);
  const { stdout } = await runProcess("hermes", args, cwd);
  const text = stdout.trim();
  const nextSessionId = sessionId ?? (await captureLatestHermesSessionId(cwd));
  return { text, sessionId: nextSessionId };
}

async function runClaudeTurn(cwd: string, prompt: string, sessionId: string | null): Promise<BridgedTurnResult> {
  const args = ["-p", prompt, "--output-format", "json"];
  if (sessionId) args.push("--resume", sessionId);
  const { stdout } = await runProcess("claude", args, cwd);
  return parseClaudeOutput(stdout);
}

async function runCodexTurn(cwd: string, prompt: string, sessionId: string | null): Promise<BridgedTurnResult> {
  // Chat mode only needs a plain conversational reply — skip codex's
  // configured apps/plugins (notion, zotero, browser, ...), which otherwise
  // load on every invocation and can hang indefinitely on an unauthenticated
  // MCP server (observed: notion never completes login non-interactively).
  const base = ["exec", "--disable", "apps", "--disable", "plugins"];
  const args = sessionId
    ? [...base, "resume", sessionId, prompt, "--json"]
    : [...base, prompt, "--json"];
  const { stdout } = await runProcess("codex", args, cwd);
  return parseCodexOutput(stdout);
}

async function runGeminiTurn(cwd: string, prompt: string, sessionId: string | null): Promise<BridgedTurnResult> {
  const args = ["-p", prompt, "-o", "stream-json", "--skip-trust"];
  if (sessionId) args.push("--resume", sessionId);
  const { stdout } = await runProcess("gemini", args, cwd);
  return parseGeminiOutput(stdout);
}

export function isBridgedProvider(provider: string): provider is BridgedProvider {
  return provider === "claude" || provider === "codex" || provider === "gemini" || provider === "hermes";
}

export async function runBridgedTurn(
  provider: BridgedProvider,
  cwd: string,
  prompt: string,
  sessionId: string | null,
): Promise<BridgedTurnResult> {
  switch (provider) {
    case "claude":
      return runClaudeTurn(cwd, prompt, sessionId);
    case "codex":
      return runCodexTurn(cwd, prompt, sessionId);
    case "gemini":
      return runGeminiTurn(cwd, prompt, sessionId);
    case "hermes":
      return runHermesTurn(cwd, prompt, sessionId);
  }
}
