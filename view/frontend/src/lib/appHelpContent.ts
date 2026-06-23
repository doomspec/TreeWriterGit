import { DEFAULT_COMMAND_CHORDS } from "@/lib/keyboardBindings";
import { formatChord } from "@/lib/keyboardChords";

export type HelpShortcut = {
  label: string;
  chordId: keyof typeof DEFAULT_COMMAND_CHORDS;
};

export type HelpShortcutGroup = {
  category: string;
  shortcuts: HelpShortcut[];
};

export const HELP_SHORTCUT_GROUPS: HelpShortcutGroup[] = [
  {
    category: "General",
    shortcuts: [
      { label: "Command palette", chordId: "palette.open" },
      { label: "Command palette (alternate)", chordId: "palette.open.alt" },
      { label: "Open settings", chordId: "settings.open" },
      { label: "Refresh model", chordId: "model.refresh" },
      { label: "Git sync now", chordId: "git.sync" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { label: "Switch to Explorer", chordId: "workspace.explorer" },
      { label: "Switch to Papers", chordId: "workspace.papers" },
      { label: "Go up one folder", chordId: "navigate.up" },
      { label: "Back to section view", chordId: "navigate.back" },
    ],
  },
  {
    category: "Create",
    shortcuts: [
      { label: "New section", chordId: "create.section" },
      { label: "New subsection", chordId: "create.subsection" },
      { label: "New unit", chordId: "create.unit" },
    ],
  },
  {
    category: "View",
    shortcuts: [
      { label: "Toggle reading focus", chordId: "readingFocus.toggle" },
      { label: "Toggle terminal & AI panel", chordId: "panel.bottom.toggle" },
      { label: "Cycle theme", chordId: "theme.cycle" },
    ],
  },
  {
    category: "Editor",
    shortcuts: [
      { label: "Layout: source", chordId: "editor.layout.source" },
      { label: "Layout: split", chordId: "editor.layout.split" },
      { label: "Layout: preview", chordId: "editor.layout.preview" },
    ],
  },
];

export const HELP_FEATURES = [
  {
    title: "Command palette",
    body: "Press ⌘K (or ⌘⇧P) anywhere to open the palette. Fuzzy search covers labels, categories, and aliases — try “focus”, “new note”, or “terminal”. Shortcuts are suppressed while typing in inputs, except palette toggles.",
  },
  {
    title: "Reading focus",
    body: "Distraction-free editing hides the sidebar, header tools, and status bar. Use the nav bar to switch Outline, Draft, or Both panes. Click the network icon beside the title to show an optional link graph. Click the document title to go up one section. Press Esc to exit focus.",
  },
  {
    title: "Block-level markdown",
    body: "Outline and draft panes use block-level editing: click a paragraph to edit in place, press Enter to split blocks, and Backspace at the start of a block to join with the previous one.",
  },
  {
    title: "Papers workspace",
    body: "Browse manuscripts under Papers. Each paper has a semantic link graph, assets panel (figures, tables, equations, references), composed section drafts, and per-unit outline/draft files with approval workflow.",
  },
  {
    title: "Terminal & AI dispatch",
    body: "The bottom panel combines a terminal with AI dispatch. Send context-aware jobs from section or unit panes. Git sync keeps the model tree aligned with your repository.",
  },
  {
    title: "Customizable shortcuts",
    body: "Rebind any command under Settings → Keyboard shortcuts. Click a shortcut, press new keys, and Esc to cancel. Reset restores the defaults listed on this page.",
  },
] as const;

export function formatDefaultChord(chordId: keyof typeof DEFAULT_COMMAND_CHORDS): string {
  const chord = DEFAULT_COMMAND_CHORDS[chordId];
  return chord ? formatChord(chord) : "—";
}

export function paletteChordLabel(): string {
  return formatDefaultChord("palette.open");
}

export function paletteAltChordLabel(): string {
  return formatDefaultChord("palette.open.alt");
}
