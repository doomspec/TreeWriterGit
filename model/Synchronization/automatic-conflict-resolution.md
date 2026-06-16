# Automatic Conflict Resolution

## v1 — shipped (manual fallback)

When an automatic rebase encounters conflicts that Git cannot resolve:

1. The synchronization process pauses and sets `conflictDetected: true` in the UI.
2. Non-`model/` working tree changes are autostashed before rebase when possible.
3. Rebase is skipped when the local branch is only **ahead** of remote (nothing to pull).
4. The user resolves conflicts in the integrated terminal.
5. Manual sync (`POST /api/git-sync/run` or header button) resumes after resolution.

The goal is reliable propagation under normal conditions; conflicts are exceptions handled by humans.

## v2 — planned (AI-assisted)

When an automatic rebase encounters conflicts that cannot be resolved trivially:

1. The synchronization process pauses.
2. A coding agent is invoked with access to the repository state, conflicting files, conflict markers, and relevant history.
3. The agent attempts to resolve merge conflicts, preserve intent, and validate consistency.
4. After resolution, the agent completes the rebase and pushes the updated branch.

This uses the existing AI Dispatch infrastructure and is not yet automated in the sync loop.
