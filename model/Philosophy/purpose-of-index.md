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

In top-down writing, a human writes the outline, story, and summary in
`INDEX.md`. An agent can then expand that plan into lower-level Markdown files
and folders. The index acts as the specification for the subtree.

In bottom-up writing, a human writes the child Markdown files first. An agent can
then create or refresh `INDEX.md` by reading those children and summarizing their
shared purpose, structure, and relationships. The index acts as the synthesized
map of the subtree.

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

## Metadata

Each `INDEX.md` should have frontmatter with a `composed_at_commit` field saying
which Git commit it was composed from. When child files change after that commit,
the index can be treated as stale and regenerated.

This turns the index into a cached summary with provenance. It does not need to
be trusted blindly; it can be checked against Git history and refreshed when the
subtree has moved on.

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

Generated views can use `INDEX.md` as the display model for each folder. The
title, summary, outline, and child links provide a natural navigation surface
without requiring a separate application database.

Because the repository remains the source of truth, the view can be discarded and
rebuilt. The durable model is the Git-backed tree of Markdown files, with
`INDEX.md` files providing the summaries and structure needed to make that tree
usable.
