# Synchronization

## Summary

The server continuously synchronizes the local repository with its remote counterpart, treating Git as the primary distributed database. Sync commits **`model/` only**; conflicts are detected on real merge markers; non-`model/` changes are autostashed before rebase.

## Outline

* [Continuous Git Synchronization](continuous-git-synchronization.md)
* [Automatic Conflict Resolution](automatic-conflict-resolution.md)
* [Distributed Collaboration](distributed-collaboration.md)

