---
title: TreeWriter
summary: A Git-native environment for writing and organizing long-form documents.
composed_at_commit: null
---

# TreeWriter

## Summary

TreeWriter is a Git-native environment for writing and organizing long-form documents such as research papers, books, technical documentation, and reports.

The repository is split into two top-level directories: `model/` and `view/`. The `model/` directory holds all document content and structure; the `view/` directory holds a generated web application that visualizes and interacts with that content.

Content in `model/` is organized as a hierarchy of nested folders and Markdown files. Every folder contains an `INDEX.md` file that serves as the entry point for its subtree, defining the outline, describing the purpose of the section, referencing child documents, and providing metadata. This turns the repository into a tree-shaped knowledge model where each node is a folder with its associated `INDEX.md`.

A typical structure looks like:

```text
model/
+-- INDEX.md
+-- Introduction/
|   +-- INDEX.md
|   `-- motivation.md
+-- Methods/
|   +-- INDEX.md
|   +-- approach.md
|   `-- experiments.md
`-- Conclusion/
    `-- INDEX.md
```

## Outline

* [Application Shape](application-shape.md)
* [Model Directory](model-directory.md)
* [Structure Example](structure-example.md)

