Open the **Assistant** panel (right side, sparkle icon). It has three parts: chat up top, then collapsible **Terminal** and **AI dispatch** sections below.

**One-shot dispatch** — pick a draft/revise action, review the built prompt, run it, then check output in `draft.md` and approve. Enable skills under **Dispatch → Skills**.

**Chat** — attach to a known CLI (claude/codex/gemini/hermes) directly, or "Already running / other" to talk through a session you started yourself in the terminal. Every turn is saved to a session file under this paper's `notes/sessions/` folder, so nothing is lost between visits.

- **Hot commands** — the row of buttons above the message box (Make draft, Revise, Cite-check, ...) builds the same prompt AI dispatch would, skills included. By default the built prompt is staged in the message box for review — edit it, then hit Enter or the send button. Tick **Auto-run** to send it immediately instead.
- **Attach files** — the paperclip button lets you pin specific outline/draft/reference files to a message; they show as removable chips above the box. On send they're included as `@path` mentions (or read server-side, depending on the CLI) so the agent sees them without you having to describe the content by hand.
- **Context pointer** — the thin bar above the chat always names the section/unit the conversation (and any hot command) is scoped to.
- **History** — the clock icon on that same bar opens past sessions for this unit, read-only.

If a chat turn edits `draft.md`/`outline.md` directly (rather than through a dispatch action), it's flagged the same as a dispatch edit and shows up in the review rail for approval.

For extra context from the terminal (cwd usually `model/`):

```bash
node ../scripts/tw-context.mjs search "keywords" --root papers/my-study
node ../scripts/tw-context.mjs read papers/my-study/unit/draft.md
```
