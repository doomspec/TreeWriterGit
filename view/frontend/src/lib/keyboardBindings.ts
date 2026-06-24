import { parseChord } from "./keyboardChords";

const STORAGE_KEY = "treewriter.keyboardBindings.v1";

export type CommandBindingDefaults = Record<string, string>;

export const DEFAULT_COMMAND_CHORDS: CommandBindingDefaults = {
  "palette.open": "Mod+K",
  "palette.open.alt": "Mod+Shift+P",
  "workspace.explorer": "Mod+1",
  "workspace.papers": "Mod+2",
  "sidebar.outline": "Mod+Shift+O",
  "sidebar.toggle": "Mod+Shift+B",
  "navigate.up": "Mod+ArrowUp",
  "navigate.back": "Mod+[",
  "create.section": "Mod+Shift+S",
  "create.unit": "Mod+Shift+N",
  "create.subsection": "Mod+Shift+U",
  "model.refresh": "Mod+R",
  "panel.bottom.toggle": "Mod+J",
  "readingFocus.toggle": "Mod+Shift+F",
  "settings.open": "Mod+,",
  "git.sync": "Mod+Shift+G",
  "editor.layout.source": "Mod+Shift+1",
  "editor.layout.split": "Mod+Shift+2",
  "editor.layout.preview": "Mod+Shift+3",
  "theme.cycle": "Mod+Shift+T",
};

export function loadKeyboardBindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function saveKeyboardBindings(bindings: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // ignore quota
  }
}

export function resolveCommandChord(
  commandId: string,
  overrides: Record<string, string>,
): string | undefined {
  const override = overrides[commandId];
  if (override === "") return undefined;
  if (override) return override;
  return DEFAULT_COMMAND_CHORDS[commandId];
}

export function buildChordIndex(
  commandIds: string[],
  overrides: Record<string, string>,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const id of commandIds) {
    const chord = resolveCommandChord(id, overrides);
    if (!chord || !parseChord(chord)) continue;
    index.set(chord.toLowerCase(), id);
  }
  return index;
}

export function resetKeyboardBindings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
