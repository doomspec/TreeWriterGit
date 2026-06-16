# Generated View

The `view/` directory contains a web application, including frontend and backend, that visualizes and interacts with the contents of the `model/` directory.

The view is automatically generated from the repository structure and **outline metadata** (`INDEX.md` files — labeled **Outline** in the UI).

Navigation, folder browse cards, and the knowledge graph read from outlines (title, summary, `child_order`, `links`, `## Outline` sections). Draft prose is edited separately and does not drive graph edges.

This creates a visual, navigable representation of the repository structure rather than exposing users directly to the file system.
