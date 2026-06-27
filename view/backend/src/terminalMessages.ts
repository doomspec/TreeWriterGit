export type TerminalClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

const MIN_COLS = 20;
const MAX_COLS = 500;
const MIN_ROWS = 5;
const MAX_ROWS = 200;
const MAX_INPUT_CHARS = 64 * 1024;

export function clampTerminalSize(cols: number, rows: number): { cols: number; rows: number } | null {
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
  const c = Math.round(cols);
  const r = Math.round(rows);
  if (c < MIN_COLS || c > MAX_COLS || r < MIN_ROWS || r > MAX_ROWS) return null;
  return { cols: c, rows: r };
}

export function parseTerminalClientMessage(raw: string): TerminalClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const message = parsed as Record<string, unknown>;
  if (message.type === "input") {
    if (typeof message.data !== "string") return null;
    if (message.data.length > MAX_INPUT_CHARS) return null;
    return { type: "input", data: message.data };
  }
  if (message.type === "resize") {
    const size = clampTerminalSize(Number(message.cols), Number(message.rows));
    if (!size) return null;
    return { type: "resize", cols: size.cols, rows: size.rows };
  }
  return null;
}
