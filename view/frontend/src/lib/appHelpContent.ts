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

export type HelpFeature = {
  title: string;
  body: string;
  hints?: readonly string[];
};

export type HelpOverleafStep = {
  title: string;
  body: string;
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
      { label: "Document outline panel", chordId: "sidebar.outline" },
      { label: "Toggle sidebar panel", chordId: "sidebar.toggle" },
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
      { label: "Focus outline pane", chordId: "editor.pane.outline" },
      { label: "Focus draft pane", chordId: "editor.pane.draft" },
      { label: "Focus notes pane", chordId: "editor.pane.notes" },
    ],
  },
];

export const HELP_FEATURES: HelpFeature[] = [
  {
    title: "Papers workspace & section tree",
    body: "Browse manuscripts under Papers. Drag sections and units to reorder. Hover a row for create, rename, and remove — or use the ⋯ menu on a narrow sidebar. Amber rows mark units with unapproved draft text.",
    hints: [
      "Create sections from the paper row; create units or subsections from section rows.",
      "On unit rows, Create adds a sibling under the parent section.",
    ],
  },
  {
    title: "Outline, draft & approval",
    body: "Each unit has outline.md and draft.md. Edit in split view; approve draft changes to sync composed section text. Section-level actions can approve all pending children at once. Each unit, section, and subsection also has temp-notes.md — a local scratchpad that autosaves but is not exported and needs no approval.",
    hints: [
      "Unapproved draft edits stay local until you approve them.",
      "Composed drafts roll up approved unit text for export.",
      "Use Split / Write / Plan presets in the header. Shift+Alt+1/2/3 still focus individual panes.",
      "Pane layout is remembered separately for each paper, section, and unit.",
    ],
  },
  {
    title: "Document outline navigation",
    body: "The Outline sidebar panel lists the paper title, top-level sections, and links from your ## Outline / ## Sections lists. Click a heading or list link to jump in the editor.",
    hints: [
      "Open from the sidebar list icon or ⌘⇧O.",
      "Linked headings in composed drafts scroll the draft pane.",
    ],
  },
  {
    title: "Sidebar pin & hover",
    body: "The icon rail is always visible. Pin the sidebar to keep the panel open; unpin to show it on hover (or tap a rail icon on small screens). Reading focus auto-collapses the panel but keeps the rail.",
  },
  {
    title: "Reading focus",
    body: "Distraction-free editing hides most chrome. Use Split / Write / Plan in the top header to switch pane layouts. Press Esc to exit.",
    hints: [
      "Split pane labels (Outline / Draft) appear in the markdown toolbar row when two panes are side by side.",
      "Select text or place the caret in the draft to show a floating format toolbar (bold, link, assets, highlights).",
      "Draft + Notes stack vertically; Outline pairs horizontally with Draft or Notes.",
      "Shift+Alt+1/2/3 focus outline, draft, or notes.",
      "Optional link graph sits beside the title in focus mode.",
    ],
  },
  {
    title: "Block-level markdown",
    body: "Outline and draft panes use block-level editing: click a paragraph to edit in place, press Enter to split blocks, and Backspace at the start of a block to join with the previous one.",
  },
  {
    title: "Figures, tables & equations",
    body: "Manage assets from the Papers sidebar. Embed figures with ::figure[], equations with ::equation[], and wikilinks for cross-references. Asset autocomplete suggests paths while you type.",
  },
  {
    title: "Export & LaTeX",
    body: "Open Export from the sidebar download icon to download LaTeX or PDF, or push to a connected Overleaf project. Toggle include drafts to export outline and non-approved text.",
    hints: [
      "Settings → Export can auto-export after edits and optionally push to Overleaf.",
      "Modular export writes one .tex file per section for Overleaf \\input{} workflows.",
    ],
  },
  {
    title: "Terminal & AI dispatch",
    body: "The bottom panel combines a terminal with AI dispatch. Each preview bundles outline, draft, links, sibling units, and paper search hits. Terminal cwd is model/; agents use tw-context for read-only lookup and pnpm import-docx from repo root for bulk Word import.",
    hints: [
      "Dispatch → Skills: enable treewriter-context-cli.md first (AI usage + CLI), then writing skills.",
      "Dispatch → Integration: copy system prompt or context CLI cheatsheet.",
      "Configure AI providers in Settings; keep pnpm dev running for FTS search.",
    ],
  },
  {
    title: "Command palette",
    body: "Press ⌘K (or ⌘⇧P) anywhere to open the palette. Fuzzy search covers labels, categories, and aliases — try “focus”, “export”, or “overleaf”. Shortcuts are suppressed while typing in inputs, except palette toggles.",
  },
  {
    title: "Customizable shortcuts",
    body: "Rebind any command under Settings → Keyboard shortcuts. Click a shortcut, press new keys, and Esc to cancel. Reset restores the defaults listed in this guide.",
  },
];

export const HELP_OVERLEAF = {
  intro:
    "TreeWriter is the writing source; Overleaf is the presentation layer for collaborators. Export generates LaTeX from approved manuscript text, pushes to your Overleaf Git clone, and can import reviewer feedback back into notes.",
  steps: [
    {
      title: "1. Open Export",
      body: "Select a paper, then open Export & Overleaf from the sidebar download icon (or search “export” / “overleaf” in the command palette).",
    },
    {
      title: "2. Connect Overleaf",
      body: "In Overleaf: Menu → Git → copy the Git URL. Paste it into TreeWriter and add a Git token if prompted. Prefer this over typing a local path in paper settings.",
    },
    {
      title: "3. Push LaTeX",
      body: "Click Push to export modular section .tex files and main.tex, commit, and push to Overleaf. Collaborators refresh in Overleaf to see updates.",
    },
    {
      title: "4. Import feedback",
      body: "After reviewers add \\todo{…} comments in Overleaf main.tex, click Import feedback in TreeWriter. Notes land under notes/feedback/ in the paper tree.",
    },
    {
      title: "5. Auto-export (optional)",
      body: "Settings → Export enables auto-export after you stop editing. Turn on Push to Overleaf to sync on each auto-export cycle.",
    },
  ] satisfies HelpOverleafStep[],
  hints: [
    "Leave “Include outlines and non-approved drafts” off for collaborator-facing pushes unless you intentionally want WIP text.",
    "Section outline.md files export as LaTeX planning-note blocks for context in Overleaf.",
    "Use Refresh clone from Overleaf if collaborators pushed Git changes you need locally.",
    "Missing citations are reported after export — fix references before final push.",
    "Paper settings → Overleaf (advanced) accepts a local clone path, but Export → Connect Overleaf is the recommended flow.",
  ],
};

export const HELP_QUICK_START = [
  "Open a paper under Papers and browse sections and units in the sidebar.",
  "Edit outline and draft in split view; approve draft changes to sync composed text.",
  "Use the document outline panel or graph to jump between linked sections.",
  "Connect Overleaf from Export when you are ready to share LaTeX with collaborators.",
  "Use AI dispatch from unit panes; tw-context CLI in the terminal fetches extra manuscript context on demand.",
  "Press ⌘⇧F for reading focus; press ⌘K whenever you forget a shortcut.",
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
