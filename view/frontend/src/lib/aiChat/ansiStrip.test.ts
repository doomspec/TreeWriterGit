import { describe, expect, it } from "vitest";
import { stripAnsi } from "./ansiStrip";

describe("stripAnsi", () => {
  it("removes CSI color codes", () => {
    expect(stripAnsi("\x1b[32mhello\x1b[0m world")).toBe("hello world");
  });

  it("removes cursor-movement CSI sequences", () => {
    expect(stripAnsi("a\x1b[2Kb\x1b[1;1Hc")).toBe("abc");
  });

  it("removes an OSC sequence terminated by BEL", () => {
    expect(stripAnsi("\x1b]0;window title\x07visible text")).toBe("visible text");
  });

  it("removes an OSC sequence terminated by ESC backslash", () => {
    expect(stripAnsi("\x1b]0;window title\x1b\\visible text")).toBe("visible text");
  });

  it("strips other control characters but keeps tabs and newlines", () => {
    expect(stripAnsi("a\x00b\tc\nd")).toBe("ab\tc\nd");
  });

  it("collapses a carriage-return spinner redraw to the final frame", () => {
    expect(stripAnsi("Working |\rWorking /\rWorking -\rDone")).toBe("Done");
  });

  it("collapses per-line while preserving other lines", () => {
    expect(stripAnsi("line one\rLINE ONE\nline two")).toBe("LINE ONE\nline two");
  });

  it("preserves line content on normal CRLF line endings (not a cursor overwrite)", () => {
    // Found live: a real shell's \r\n-terminated output was being reduced to
    // just the final prompt line because every trailing \r was treated as an
    // overwrite, even when immediately followed by \n.
    const raw = "echo hello-chat-test\r\nhello-chat-test\r\nIlya-MacBook-Pro-3% ";
    expect(stripAnsi(raw)).toBe("echo hello-chat-test\nhello-chat-test\nIlya-MacBook-Pro-3% ");
  });

  it("passes plain text through unchanged", () => {
    expect(stripAnsi("Rewrite the intro paragraph.")).toBe("Rewrite the intro paragraph.");
  });

  it("handles realistic mixed output from an interactive CLI", () => {
    const raw = "\x1b[1G\x1b[2K\x1b[32m✓\x1b[0m Done — tightened the opening sentence.\x1b[1G";
    expect(stripAnsi(raw)).toBe("✓ Done — tightened the opening sentence.");
  });
});
