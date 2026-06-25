Open the **AI dispatch** panel (terminal area or bot icon). Choose draft/revise actions; review output in `draft.md`, then approve.

Enable skills under **Dispatch → Skills**. For extra context from the terminal (cwd usually `model/`):

```bash
node ../scripts/tw-context.mjs search "keywords" --root papers/my-study
node ../scripts/tw-context.mjs read papers/my-study/unit/draft.md
```
