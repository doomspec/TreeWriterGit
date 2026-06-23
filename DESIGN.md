# TreeWriter — Design System

> Synthesized from ui-ux-pro-max + Impeccable product register. See also `design-system/treewriter/MASTER.md`.

## Theme

Light, restrained product UI with teal research accent. **Cool neutral surfaces** (210° hue, low chroma) — not cream/sand AI defaults. Dark mode uses **scholarly teal-tinted slate**, not generic coding black. Terminal uses a dedicated dark surface token — intentional contrast island.

## Color roles

| Token | Role |
|-------|------|
| `--primary` | Teal — links, active tab, focus ring, primary actions |
| `--foreground` | Body ink — headings and UI labels |
| `--muted-foreground` | Secondary labels (≥4.5:1 on `--background`; light ~38% L, dark ~66% L) |
| `--sidebar-bg` / `--workspace-bg` / `--editor-bg` | Three-tier surface hierarchy |
| `--overlay` | Modal and drawer backdrops (theme-aware, not raw black) |
| `--shadow-sm/md/lg` | Elevation — stronger in dark mode for legible popovers |
| `--success` / `--warning` | Dispatch status, git sync, diff highlights, attached assets |
| `--terminal-bg` | Agent terminal only |

## Typography

| Layer | Stack | Use |
|-------|-------|-----|
| UI | Atkinson Hyperlegible, system-ui | Chrome, nav, toolbars, forms |
| Reading | Crimson Pro, Georgia, serif | Rendered markdown headings in prose |
| Reading body | Georgia, Palatino | Markdown body (existing) |
| Mono | ui-monospace | Raw markdown, paths, terminal |

### UI scale (fixed rem)

- `text-ui-2xs` (10px) — badges, meta
- `text-ui-xs` (11px) — section labels, tree rows
- `text-xs` (12px) — default compact UI
- `text-sm` (14px) — header title, buttons

Headings in rendered markdown use `text-wrap: balance` for cleaner line breaks.

## Layout

- **App shell**: 44px header, 36px footer, 3-column grid (sidebar | workspace | agent)
- **Breakpoints**: 375 (tight chrome) · 720 (stacked sidebar) · 768 (bottom panel) · 900 (dual pane) · 1100 (editor split) · 1280 (full grid)
- **Reading column**: max 42rem centered in preview modes
- **Body min-width**: 320px

## Components

- **ui-label** — uppercase section headers (Outline, Draft, Terminal)
- **ui-badge** — status pills (git, terminal, session)
- **ui-nav-row** — sidebar tree / list rows with hover + active states
- **ui-tab** — sidebar tab strip
- **ui-surface-popover** — menus and autocomplete with theme shadow

## Motion

150–200ms ease-out on hover/focus color transitions. No bounce. Reduced-motion: instant.

## Graph node colors

Semantic HSL tokens: paper (violet), section (blue), unit (teal), note (amber), doc (slate), missing (red).
