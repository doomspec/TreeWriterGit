```text
STRUCTURE
  Paper   → papers/{slug}/
  Section → …/introduction/     (container)
  Unit    → …/introduction/problem/  (leaf, has draft.md)
  Figure  → …/figures/fig1/

STATUS: outline → drafted → approved

MARKUP
  Cite:     [@cite_key]
  Figure:   ::figure[papers/slug/figures/name]
  Fig ref:  [[papers/slug/figures/name|Figure 1]]
  Equation: ::equation[papers/slug/equations/name]
  Table:    [[papers/slug/tables/name|Table caption]]

UI: Papers tree · Assets · Section/Unit view · ? guide · Export panel
```
