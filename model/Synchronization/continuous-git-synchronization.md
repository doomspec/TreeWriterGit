# Continuous Git Synchronization

The server treats the remote repository as the ground truth for shared state. Rather than requiring participants to manually push and pull changes, a background synchronization loop continuously reconciles local and remote state, making Git behave more like a distributed database than a version control system.

## Synchronization Cycle

Every 120 seconds, the server performs the following workflow:

1. Fetch updates from the remote repository.
2. Attempt a fast, automatic rebase of local changes onto the latest remote state.
3. If the local workspace contains modifications:
   * Stage all changes.
   * Create a commit with the message `Automated sync`.
   * Push the resulting commit to the remote repository.
4. If no changes exist, no commit is created.

## Rationale for Rebasing

Rebasing is preferred over merging because it produces a linear commit history. A linear history makes it easier to trace the provenance of any change and simplifies automated conflict resolution when it is needed. Fast-forward rebases are resolved entirely by Git without any agent involvement.

## Conflict Handling

When a rebase encounters conflicts that Git cannot resolve automatically, the synchronization cycle does not abort silently. Instead, it delegates resolution to a coding agent. See [Automatic Conflict Resolution](automatic-conflict-resolution.md) for details.

## Cycle Interval

The 120-second interval balances two competing concerns: propagating changes quickly enough that collaborators work from a recent shared state, and avoiding excessive commit noise from near-empty sync commits. For most editing workflows this cadence means a change is visible to all participants within two minutes of being saved locally.

## Relationship to the Repository-as-Model Principle

Continuous synchronization is what makes the repository viable as a live, shared data model rather than a series of snapshots. Because changes are propagated automatically and conflicts are resolved without human intervention under normal conditions, participants can treat their local workspace as a continuously updated view of the shared state rather than an isolated branch that occasionally needs to be reconciled.

## Sync scope (current implementation)

Automated sync only commits configured **commit paths** (default: `model/`). Paths listed under **exclude paths** (default: `view/`) are never committed; they are temporarily stashed during rebase and restored after push so local source edits do not block sync.

Configure in `.treewriter.json`:

```json
{
  "gitSync": {
    "commitPaths": ["model"],
    "excludePaths": ["view"]
  }
}
```

Or with environment variables (override the file):

* `GIT_SYNC_COMMIT_PATHS=model,exports` — comma-separated folders to commit
* `GIT_SYNC_EXCLUDE_PATHS=view,scripts` — never committed; stashed only for rebase
* `GIT_SYNC_ENABLED=false` — disable the loop
* `GIT_SYNC_INTERVAL_MS=120000` — interval in milliseconds (default 120s)

Other repo paths outside commit and exclude lists are autostashed during rebase and restored after a successful push.
