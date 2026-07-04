TreeWriter treats a paper as a **recursive folder tree** stored in Git under `model/papers/{paper-slug}/`. You edit in the web UI; export assembles approved unit drafts into LaTeX/PDF (and optionally pushes to Overleaf).

Each node uses up to three coordinated files: **INDEX.md** (metadata and ordering), **outline.md** (what to say), and **draft.md** (exportable manuscript text on unit leaves).

The **Assistant** panel (sparkle icon) provides chat, dispatch hot commands, and an integrated terminal for AI-assisted writing. Everything in `model/` is Git-tracked — use your normal commit workflow for collaboration.

::figure[papers/treewriter-guide/figures/fig-workflow]
