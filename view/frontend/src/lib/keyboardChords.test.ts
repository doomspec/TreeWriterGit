import { describe, expect, it } from "vitest";

import {
  chordFromKeyboardEvent,
  eventMatchesChord,
  formatChord,
  normalizeKey,
  parseChord,
} from "./keyboardChords";

describe("parseChord", () => {
  it("parses modifier chords", () => {
    expect(parseChord("Mod+Shift+P")).toEqual({
      mod: true,
      shift: true,
      alt: false,
      key: "p",
    });
  });

  it("normalizes arrow keys", () => {
    expect(parseChord("Mod+ArrowUp")?.key).toBe("up");
  });

  it("parses comma shortcut", () => {
    expect(parseChord("Mod+,")?.key).toBe(",");
  });
});

describe("eventMatchesChord", () => {
  it("matches mod+key on macOS meta", () => {
    const event = {
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      key: "k",
    } as KeyboardEvent;
    expect(eventMatchesChord(event, "Mod+K")).toBe(true);
  });

  it("rejects when shift differs", () => {
    const event = {
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      key: "p",
    } as KeyboardEvent;
    expect(eventMatchesChord(event, "Mod+Shift+P")).toBe(false);
  });
});

describe("chordFromKeyboardEvent", () => {
  it("ignores bare modifier keys", () => {
    expect(
      chordFromKeyboardEvent({ key: "Meta", metaKey: true } as KeyboardEvent),
    ).toBeNull();
  });

  it("builds chord string", () => {
    expect(
      chordFromKeyboardEvent({
        key: "ArrowUp",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      } as KeyboardEvent),
    ).toBe("Mod+up");
  });
});

describe("normalizeKey", () => {
  it("aliases escape and space", () => {
    expect(normalizeKey("Escape")).toBe("esc");
    expect(normalizeKey(" ")).toBe("space");
  });
});

describe("formatChord", () => {
  it("returns readable chord text", () => {
    expect(formatChord("Mod+Shift+P")).toMatch(/P/i);
  });
});
