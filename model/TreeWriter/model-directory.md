# Model Directory

The `model/` directory contains the document content and structure.

Every folder uses **three coordinated files** (units include all three; containers use INDEX + outline only):

| File | Audience | Contents |
|------|----------|----------|
| **`INDEX.md`** | System / agents (hidden in UI) | `kind`, `child_order`, `section_order`, `links`, `status`, `composed_at_commit`, authors, journal |
| **`outline.md`** | Authors & readers | Section overview: `## Summary`, narrative arc, `## Outline` child links |
| **`draft.md`** | Authors (units only) | Manuscript text assembled into the final document |

## Node types (papers)

| Node | INDEX (technical) | outline.md | draft.md |
|------|-------------------|------------|----------|
| **Paper** | `section_order`, thesis, authors, journal, status | Paper summary + section links | — |
| **Section** | `child_order`, cross-section `links` | Section overview + child links | — |
| **Unit** | `status`, `links`, citations metadata | Paragraph overview (what to say) | Manuscript paragraph |

See [[phase-2-paper-model]] and [[purpose-of-index]] for schemas and the agent contract.

This structure turns the repository into a tree-shaped knowledge model where each node is a folder with hidden INDEX metadata, a visible outline, and optional draft prose.
