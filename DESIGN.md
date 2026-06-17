# TreeWriter — Design System

> Synthesized from ui-ux-pro-max + Impeccable product register. See also `design-system/treewriter/MASTER.md`.

## Theme

Light, restrained product UI with teal research accent. Warm neutral surfaces (not cream/sand default). Terminal uses a dedicated dark surface token — intentional contrast island.

## Color roles

| Token | Role |
|-------|------|
| `--primary` | Teal — links, active tab, focus ring, primary actions |
| `--foreground` | Body ink — headings and UI labels |
| `--muted-foreground` | Secondary labels (≥4.5:1 on `--background`) |
| `--sidebar-bg` / `--workspace-bg` / `--editor-bg` | Three-tier surface hierarchy |
| `--success` / `--warning` | Dispatch status, positive git sync |
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

## Layout

- **App shell**: 44px header, 32px footer, 3-column grid (sidebar | workspace | agent)
- **Breakpoints**: 1280 / 1024 / 720 (grid), 900 (dual pane), 1100 (editor split)
- **Reading column**: max 42rem centered in preview modes

## Components

- **ui-label** — uppercase section headers (Outline, Draft, Terminal)
- **ui-badge** — status pills (git, terminal, session)
- **ui-nav-row** — sidebar tree / list rows with hover + active states
- **ui-tab** — sidebar tab strip

## Motion

150–200ms ease-out on hover/focus color transitions. No bounce. Reduced-motion: instant.

## Graph node colors

Semantic HSL tokens: paper (violet), section (blue), unit (teal), note (amber), doc (slate), missing (red).
