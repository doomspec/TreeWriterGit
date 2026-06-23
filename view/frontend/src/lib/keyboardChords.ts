/** Platform-aware modifier: ⌘ on macOS, Ctrl elsewhere. */
export function isModKey(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">): boolean {
  return event.metaKey || event.ctrlKey;
}

const KEY_ALIASES: Record<string, string> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  escape: "esc",
  " ": "space",
};

export function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

export type ParsedChord = {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

export function parseChord(chord: string): ParsedChord | null {
  const trimmed = chord.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("+").map((part) => part.trim().toLowerCase());
  const keyPart = parts[parts.length - 1];
  if (!keyPart) return null;
  return {
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: normalizeKey(keyPart),
  };
}

export function formatChord(chord: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const isMac =
    typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
  const parts: string[] = [];
  if (parsed.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (parsed.shift) parts.push(isMac ? "⇧" : "Shift");
  if (parsed.alt) parts.push(isMac ? "⌥" : "Alt");
  parts.push(parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key);
  return parts.join(isMac ? "" : "+");
}

export function eventMatchesChord(
  event: KeyboardEvent,
  chord: string,
): boolean {
  const parsed = parseChord(chord);
  if (!parsed) return false;
  if (parsed.mod !== isModKey(event)) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.alt !== event.altKey) return false;
  return normalizeKey(event.key) === parsed.key;
}

export function chordFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (event.key === "Control" || event.key === "Meta" || event.key === "Shift" || event.key === "Alt") {
    return null;
  }
  const parts: string[] = [];
  if (isModKey(event)) parts.push("Mod");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  parts.push(normalizeKey(event.key));
  return parts.join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}
