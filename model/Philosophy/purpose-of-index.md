# Purpose of INDEX.md

`INDEX.md` is the entry point for a subtree in the model repository.

It gives each folder a readable identity, a local outline, and enough summary
context for both humans and agents to understand what belongs beneath that
folder. Ordinary Markdown files hold the detailed content. `INDEX.md` explains
how those files relate to each other.

This makes a directory more than a container of files. It becomes a node in a
tree-shaped document model.

## Two Writing Directions

`INDEX.md` enables two complementary ways of writing: top down and bottom up.

In top-down writing, a human writes the overview in **`outline.md`**. An agent
then expands that plan into `draft.md` and child folders. The INDEX file tracks
structure (`child_order`, links) for the system.

In bottom-up writing, a human writes `draft.md` (and child content) first. An
agent refreshes **`outline.md`** from those files and updates INDEX metadata as
needed.

The same file supports both directions because it sits between intent and
implementation. It can be written before the children exist, or regenerated after
the children change.

## Local Context

Each `INDEX.md` should answer four questions about its folder:

* What is this subtree about?
* What are its main children?
* How do those children fit together?
* What should a reader or agent expect to find here?

This context is intentionally local. A root `INDEX.md` describes the whole
repository. A nested `INDEX.md` describes only the section beneath its own
folder. This keeps each node small enough to edit, summarize, regenerate, and
review.

## Metadata (INDEX.md — technical, not shown in UI)

Each folder's **`INDEX.md`** holds coordination metadata only: `composed_at_commit`, `child_order`, `links`, `status`, and similar fields. Authors edit **`outline.md`** for the readable overview and **`draft.md`** for manuscript text.

When child files change after the commit recorded in `composed_at_commit`, the outline can be treated as stale and regenerated.

## Agent Contract

Agents should treat `INDEX.md` as both content and coordination metadata.

When expanding top down, an agent should preserve the stated intent of the index
and create children that make the outline concrete.

When summarizing bottom up, an agent should preserve the actual meaning of the
children and avoid inventing structure that the subtree does not support.

When refreshing an existing index, an agent should keep stable titles, links, and
human-authored framing where they still match the children. Regeneration should
make the index more accurate, not erase useful editorial decisions.

## Role in Generated Views

Generated views can use each folder's outline as the display model. The
title, summary, outline links, and child order provide a natural navigation
surface without requiring a separate application database.

In TreeWriter, **`INDEX.md` is hidden** from the file tree. Authors see
**Outline** (`outline.md`) and **Draft** (`draft.md`). The graph uses INDEX
`links` plus outline structure — not draft wikilinks.

Because the repository remains the source of truth, the view can be discarded and
rebuilt. The durable model is the Git-backed tree of Markdown files, with
outline files (`INDEX.md`) providing the summaries and structure needed to make
that tree usable.
