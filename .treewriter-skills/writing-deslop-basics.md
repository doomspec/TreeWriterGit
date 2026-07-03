---
name: writing-deslop-basics
description: Deslop / de-AI a TreeWriter draft — strip AI writing tells (em dashes, filler, formulaic structures, hype) so prose reads like careful human scientific writing. Use on any draft.md drafting, revision, or expansion. For structural/story-level work use scientific-writing-framework.
---

# Writing Deslop Basics (Scientific Drafts)

Apply whenever you **draft, revise, or expand** unit `draft.md` text. Preserve meaning, citations `[@…]`, and TreeWriter embeds (`::figure`, `::equation`, table wikilinks). Change **voice and wording only** unless the task asks for structural edits.

**Goal:** direct, precise scientific prose — not marketing copy, not chatbot cadence.

---

## Punctuation and formatting tells

| Avoid | Prefer |
|-------|--------|
| Em dashes (`—`) | Commas, parentheses, or split into two sentences |
| En dashes for asides where a comma works | Standard punctuation |
| Unicode arrows (`→`, `⇒`) in prose | Words: "to", "therefore", "so" |
| Bold-lead bullets in running text | Plain sentences or a real list when needed |
| "In conclusion…" / "To summarize…" signposts | End with the substantive point |

**Rule:** if a sentence needs an em dash, rewrite the sentence.

---

## Cut filler (delete, don't replace with synonyms)

Remove throat-clearing and padding:

- "It's worth noting that…", "It is important to note…", "Notably,…"
- "In this section, we…", "Here, we…" (when the subject is already clear)
- "Let's break this down", "Let's dive in", "Let's explore"
- "Moving forward", "going forward", "at the end of the day"
- "plays a crucial/key/pivotal role", "serves as a testament"
- "Despite these challenges…" (state the limitation directly)
- "The implications are significant" (name the implication)

---

## AI vocabulary — replace or cut

| Cut or replace | Use instead |
|----------------|-------------|
| delve, underscore, highlight (vague), leverage | examine, show, use |
| landscape, ecosystem, paradigm shift | specific domain terms |
| robust, nuanced, comprehensive (empty praise) | measurable claim or delete |
| utilize | use |
| groundbreaking, transformative, cutting-edge | evidence or delete |
| tapestry, interplay, multifaceted | plain description |

Domain terms are fine when precise ("weighted interval score"). Buzzwords are not.

---

## Break formulaic structures

Rewrite these patterns into plain statements:

- **Binary contrast:** "Not X. Y." / "It's not about X — it's about Y" → state Y.
- **Rhetorical Q&A:** "The result? A 40% gain." → "Accuracy improved by 40%."
- **Tricolon abuse:** three parallel fragments for drama → one or two clear sentences.
- **Anaphora stacks:** "We did A. We did B. We did C." → vary openings; merge where possible.
- **Stakes inflation:** "revolutionize", "fundamentally change the field" → proportionate claim + citation.
- **False ranges:** "from data to insights to impact" → delete or specify one concrete link.

---

## Scientific register

- **Active voice** with real subjects: "We measured…", "The model predicts…", not "It was found that…"
- **Specific claims** over vague authority: cite `[@key]` instead of "researchers have shown"
- **One idea per sentence** when possible; vary sentence length — avoid metronomic rhythm
- **No meta-commentary** about the paragraph ("This paragraph argues…")
- **No engagement bait** ("It remains an open question whether…" without a real gap)
- **Trust the reader** — do not restate the same point three ways in one paragraph

---

## Preserve on deslop passes

Do **not** remove or break:

- Pandoc citations: `[@cite_key]`, `[@a; @b]`
- Figure embeds: `::figure[papers/…/figures/…]`
- Equation embeds: `::equation[papers/…/equations/…]`
- Table wikilinks: `[[papers/…/tables/…|…]]`
- Cross-ref wikilinks to figures/equations in running text
- Defined technical notation and symbols

Convert `\cite{…}` to `[@…]` if present; do not introduce LaTeX shortcuts.

---

## Quick pass checklist

Before saving revised `draft.md`:

1. **Zero em dashes** in the paragraph (search for `—` and `-` used as dashes).
2. **No filler openers** in the first sentence.
3. **No empty intensifiers** (crucial, pivotal, nuanced) without measurable content.
4. **No binary-contrast drama** or punchy one-line paragraph endings stacked throughout.
5. **Claims tied to evidence** — citation or concrete number where the original implied one.
6. **Embeds and cite keys unchanged** unless fixing a clear error.

---

## Mini before/after

**Before (AI slop):**
> It's worth noting that our approach — which leverages a robust transformer architecture — plays a crucial role in navigating the challenges of cell counting. The result? Improved accuracy. This highlights the transformative potential of the method.

**After (deslop):**
> Our transformer model reduced counting error by 18% on the held-out plate images [@smith2024], with the largest gains on dense clusters where prior methods double-counted overlapping cells.

Changes: removed filler, em dash, rhetorical setup, hype; added specific outcome and citation placeholder pattern.
