# Integrated Terminal

## Current implementation (2026)

The **Agent panel** (right sidebar, hideable) contains:

* **AI Dispatch** — preview and run agent commands against the current folder or unit
* **Terminal** — PTY connected to the `model/` directory (`cwd: modelRoot`)

Toggle via the panel icon in the header or the chevron on the Agent panel.

Capabilities include:

* **Draft from outline** — generate `draft.md` from the unit outline
* **Sync outline from draft** — update the outline from existing draft prose (bottom-up)
* **Refresh outline** — regenerate a section outline from its children
* Executing repository-specific tooling and scripts

Because the model is stored entirely in Git, all modifications made through the UI or terminal remain version-controlled and auditable.

## Original spec

The left side of the interface contains a terminal connected to the `model/` directory.

The terminal location was moved to the right Agent panel during the Quartz/Overleaf UI refactor.
