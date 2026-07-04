# Manuscript editor — verification checklist

Run before marking a delivery phase complete:

```bash
cd view/backend && npm test
cd view/frontend && npm test
```

## Phase A (scaffold + modal)

- [ ] Create paper via modal → IMRaD sections + figures/tables/equations + notes
- [ ] Create grant via modal → grant sections + grant notes, no Overleaf in UI
- [ ] Create report via modal → report sections scaffold
- [ ] Existing manuscripts (`treewriter-guide`, etc.) open without migration
- [ ] Approve draft on new grant — no navigation jump

## Phase B (export + kind helpers)

- [ ] Export grant → DOCX; Overleaf controls hidden
- [ ] Export paper → LaTeX + Overleaf unchanged
- [ ] Sidebar filter: grants only / papers only

## Phase C (tags + projects)

- [ ] Two manuscripts same `project:` → filter/tag finds both
- [ ] Tag search finds cross-type manuscripts

## Phase D (Ara manifest fields)

- [ ] Dispatch context includes `doc_type`, `contribution_mode`, `agent_summary` when set
