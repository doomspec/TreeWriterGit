# Continuous Git Synchronization

Every 120 seconds, the server performs the following workflow:

1. Fetch updates from the remote repository.
2. Attempt a fast, automatic rebase of local changes onto the latest remote state.
3. If the local workspace contains modifications:
   * Stage all changes.
   * Create a commit with an empty commit message.
   * Push the resulting commit to the remote repository.
4. If no changes exist, no commit is created.

