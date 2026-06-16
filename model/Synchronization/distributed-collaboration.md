# Distributed Collaboration

## Current implementation (2026)

Multiple humans and agents can work on the same repository concurrently via:

* **Git sync** — `model/` changes committed and pushed every 120s; non-`model/` WIP autostashed during rebase
* **Manual conflict resolution** — rebase conflicts pause sync; user resolves in the Agent panel terminal
* **AI dispatch** — per-folder/unit agent commands (draft, review, refresh-index, etc.)

Not yet built: comments API, real-time cursors, CRDT editing, server-side agent job queue.

## Vision

This synchronization model allows multiple humans and agents to work on the same repository concurrently.

Each participant interacts with their local view of the repository, while the synchronization service continuously propagates changes through Git.

Conflicts become exceptions rather than the primary coordination mechanism. AI-assisted conflict resolution (v2) is planned; v1 uses manual terminal fallback.

