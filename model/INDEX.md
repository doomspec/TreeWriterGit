---
title: Git-Based Automated Model-View System
summary: A Git-native model-view architecture where repository content is the source of truth and generated views provide tailored interfaces.
composed_at_commit: null
---

# Git-Based Automated Model-View System

## Summary

The cost of generating software interfaces has dropped dramatically with modern coding agents. This enables a new paradigm: store the entire application state and content in Git, and automatically generate tailored views for each repository.

The repository becomes the source of truth, while views are generated dynamically to help users navigate, edit, and interact with the content.

## Outline

* [Philosophy](Philosophy/INDEX.md)
  * [Repository as Model](Philosophy/repository-as-model.md)
  * [Purpose of INDEX.md](Philosophy/purpose-of-index.md)
* [TreeWriter](TreeWriter/INDEX.md)
  * [Application Shape](TreeWriter/application-shape.md)
  * [Model Directory](TreeWriter/model-directory.md)
  * [Structure Example](TreeWriter/structure-example.md)
* [View](View/INDEX.md)
  * [Generated View](View/generated-view.md)
  * [Main Content Area](View/main-content-area.md)
  * [Integrated Terminal](View/integrated-terminal.md)
  * [Status Column](View/status-column.md)
* [Synchronization](Synchronization/INDEX.md)
  * [Continuous Git Synchronization](Synchronization/continuous-git-synchronization.md)
  * [Automatic Conflict Resolution](Synchronization/automatic-conflict-resolution.md)
  * [Distributed Collaboration](Synchronization/distributed-collaboration.md)

