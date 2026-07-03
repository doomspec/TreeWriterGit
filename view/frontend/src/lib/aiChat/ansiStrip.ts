/**
 * Strip ANSI/VT100 escape sequences and control characters from captured
 * terminal output, and collapse carriage-return overwrites (spinners,
 * progress bars) to their final visible state. Not a full terminal
 * emulator — good enough for turning PTY output into a readable chat
 * bubble (plans/ai-assistant-panel.md, Stage 4).
 */

// CSI sequences (\x1b[...letter), OSC sequences (\x1b]...BEL or \x1b...\x1b\\),
// and other common two-char escapes (\x1b + single letter, e.g. \x1bM).
const ANSI_RE = new RegExp(
  "\\x1b(?:" +
    "\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)" + // OSC ... BEL | OSC ... ESC \
    "|\\[[0-9;?]*[ -/]*[@-~]" + // CSI ... final byte
    "|[@-Z\\\\^_]" + // simple 2-byte escapes
    ")",
  "g",
);

// Other non-printable control chars, excluding tab (\x09), newline (\x0a),
// and carriage return (\x0d, handled separately below).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/**
 * Walk the text distinguishing real line endings from cursor-return
 * overwrites: "\r\n" is a normal newline (line content must be kept), while
 * a bare "\r" not followed by "\n" resets the current line back to column 0
 * (spinner/progress-bar redraw) so only its final frame survives.
 */
function collapseCarriageReturns(text: string): string {
  const lines: string[] = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      lines.push(current);
      current = "";
      i += 1;
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        lines.push(current);
        current = "";
        i += 2;
      } else {
        current = "";
        i += 1;
      }
    } else {
      current += ch;
      i += 1;
    }
  }
  lines.push(current);
  return lines.join("\n");
}

export function stripAnsi(raw: string): string {
  const withoutEscapes = raw.replace(ANSI_RE, "").replace(CONTROL_RE, "");
  return collapseCarriageReturns(withoutEscapes);
}
