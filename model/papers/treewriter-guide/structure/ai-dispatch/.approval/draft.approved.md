Open the **Assistant** panel (sparkle icon, right split). It combines chat, dispatch hot commands, and a collapsible terminal (cwd = `model/`).

**Hot commands** — Make draft, Revise, Cite-check, and similar buttons build the same prompt as dispatch, system + user skills included. By default the prompt is staged in the message box for review; tick **Auto-run** to send immediately.

**Chat** — attach to a configured CLI or talk through a session you started in the terminal. Paper-wide history lives under `papers/{slug}/notes/sessions/chat-*.md`; use **Continue** to resume bridged providers.

**Skills** — Settings → Skills: **system/** skills (TreeWriter runtime + action prompts) always load; enable **user/** writing rules as needed. Edit action prompts (`dispatch-draft.md`, etc.) with **Reset** to restore repo defaults.

**Attach files** — paperclip pins outline/draft/reference paths as removable chips; sent as `@path` mentions.

**Context pointer** — bar above chat names the scoped unit/section. Clock icon opens past sessions for this unit.

If chat edits `draft.md` or `outline.md` directly, changes appear in the review rail like dispatch edits.

Extra context from the terminal (cwd usually `model/`):

```bash
node ../scripts/tw-context.mjs search "keywords" --root papers/my-study
node ../scripts/tw-context.mjs read papers/my-study/unit/draft.md
node ../scripts/tw-context.mjs context papers/my-study/unit --action draft
node ../scripts/tw-context.mjs graph papers/my-study/unit
node ../scripts/tw-context.mjs sessions papers/my-study --kind chat
node ../scripts/tw-context.mjs health
```

Keep `pnpm dev` running for API-backed commands (`search`, `context`, `graph`, `health`). `read` and `sessions` work offline.
