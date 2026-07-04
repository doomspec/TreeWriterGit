```text
STRUCTURE
  Paper   → papers/{slug}/
  Section → …/introduction/     (container)
  Unit    → …/introduction/problem/  (leaf, has draft.md)
  Figure  → …/figures/fig1/
  Approved → unit/.approval/draft.approved.md

STATUS: outline → drafted → approved

MARKUP
  Cite:     [@cite_key]
  Figure:   ::figure[papers/slug/figures/name]
  Fig ref:  [[papers/slug/figures/name|Figure 1]]
  Equation: ::equation[papers/slug/equations/name]
  Table:    [[papers/slug/tables/name|Table caption]]

UI
  Explorer / Writer modes
  Sidebar: Paper info · Sections · Assets · Export
  Header logo → Paper info panel (not Sections)
  Assistant panel (sparkle) · ? guide · Export

TW-CONTEXT (terminal cwd = model/)
  search · read · tree · compose · context · graph · sessions · health
  pnpm tw-context … from repo root
```
