---
name: scientific-writing-framework
description: Analyse, write, or edit a scientific manuscript with the multi-level framework — manuscript / section / paragraph / word. Triggers include scientific writing, manuscript or grant or thesis review, story arc (why/what/so what), hourglass structure, abstract quality, signposting, and section-function checks. For AI-slop cleanup of a draft's prose, use writing-deslop-basics; for making a technology the star of a methods/tool paper, use technology-paper.
---

# Multi-Level Framework for Scientific Writing

Analyse, write, and edit manuscripts at four hierarchical levels, broadest to finest.

**Core principle:** write top-down, edit bottom-up. Fix the story before polishing words; a perfect sentence in the wrong section is wasted.

Sources: pedagogical framework (Zenodo [10.5281/zenodo.18148137](https://doi.org/10.5281/zenodo.18148137), CC BY-SA 4.0) and Reinschrift Science Communication, A. Trabesinger, AC/UofT (Zenodo [18642949](https://zenodo.org/records/18642949)).

| Level | Focus | Key question |
|-------|-------|--------------|
| **Manuscript** | Story arc, overall narrative | Why? What? So what? |
| **Section** | Function of each part | Does each section do its job? |
| **Paragraph/Sentence** | Flow, coherence, signposting | Is the logic visible and connected? |
| **Word** | Economy, precision, formality | Is every word earning its place? |

---

## Level 1 — Manuscript: the story

Every paper answers three questions: **Why?** (problem, gap, motivation) → **What?** (what you did and found) → **So what?** (implications).

**Four-sentence storytelling exercise — write these before drafting anything else:**
1. **Background:** why is this work interesting?
2. **Open question** ("However, …"): what is the roadblock?
3. **Contribution** ("Here, …"): what gap does this fill?
4. **Result and significance:** what can we now do that we could not before?

**Diagnostic:** can you state the story in these four sentences? Is the "so what" specific, not generic? Does the thread run from introduction through discussion?

**Hourglass structure:** broad field → your specific contribution → broader implications. High-impact journals often add an "in a nutshell" summary paragraph above the hourglass body.

**Abstract:** the story in miniature, self-contained (background + gap + contribution + significance). A non-specialist should grasp the significance; main findings stated, not hinted.

**Figures carry the story** — often read first. Aim for three roles: an **overview** figure (system/approach), **results** figures (substantiate claims), an **outlook** figure (implications). Each figure is called out in text with context; the paper's message should be legible from figures alone.

**Reader hierarchy** — each depth must work for its reader:

| Reader | Reads | Needs |
|--------|-------|-------|
| Quick | Title, abstract, figures | Complete story, compressed |
| General | + Introduction, conclusions | Context and significance |
| Specialist | Full text | Methods, detail, nuance |

**SI reproducibility test:** could a newcomer to the subfield (a strong MSc/first-year PhD student) reproduce the work from the SI? The SI holds everything paper-specific not available elsewhere — protocols, parameters, derivations, code, data. Standard background belongs in textbooks; paper-specific knowledge belongs in the SI.

**Navigability:** descriptive (not generic) section headings; leading sentences that signal each paragraph's point; informative figure-caption titles that summarise the finding, not "Figure 1".

---

## Level 2 — Section: function

Each section has one job. Evaluate whether it does it.

| Section | Purpose | Structure | Target reader |
|---------|---------|-----------|---------------|
| **Title** | Describe what was *found* (not done) | Concise, keyword-rich, no acronyms/clichés | All |
| **Abstract** | Self-contained story | Hourglass / 7-block (below) | Busy reader |
| **Introduction** | Elaborate "why?", set the scene | Funnel: general → specific | General reader |
| **Methods** | Enable exact repetition ("recipe") | Logical step sequence | Expert |
| **Results** | Present findings as evidence | Sequence tied to figures | Expert |
| **Discussion** | Interpret, compare to prior work | Claim → evidence → context | Expert |
| **Conclusions** | Answer "so what?" | Implications + limitations, no repetition | Cross-disciplinary |
| **Supplementary** | Remove reproducibility barriers | Datasets, code, extended methods; no new conclusions | Newcomer |

**Nature abstract — 7-block formula** (nature.com/documents/nature-summary-paragraph.pdf): (1) intro any scientist grasps, 1–2 sent; (2) detailed background, 2–3; (3) general problem, 1; (4) **main result — must contain "here we show/present"**, 1; (5) what it adds vs prior knowledge, 2–3; (6) general context/validation, 1–2; (7) broader perspective, 2–3 (optional). ~190 words without block 7, ~250 with. Ultra-compact (Nature Biotech Brief Communication): 3 sentences, ~70 words, no refs.

**Grant-proposal-abstract failure mode:** in physics/Nature-family venues, a frequent error is broad context → method → vague results — this reads like a grant proposal and buries the finding. Lead with the result (or the surprise), then use "Here we…" to introduce the approach. Test: *could a reader state the main finding after reading only the abstract?*

**Introduction funnel:** general field → why it matters → prior work → best current solution → gap ("However, …") → aim → contribution ("Here, we …").

**Title:** describe the finding, not the method; keyword-rich; no acronyms. Avoid clichés: Holy Grail, silver/magic bullet, shedding (new) light, paradigm shift, game changer, Rosetta Stone, missing link, breakthrough.

**Results:** each paragraph makes a scientific *statement* using the figure as evidence — it does not narrate what the figure shows (that is the caption's job). Open with the question the paragraph addresses, present evidence, signpost the connection to what follows. Make the logic between consecutive observations explicit. Remove placeholders and author notes before submission.

**Discussion:** open with the main finding *interpreted* (its significance), not a replay of Results. Consider alternatives, acknowledge limitations honestly, funnel back out to the field.

**Interdisciplinary summaries:** PNAS "Significance" (Why → However → Here → So what; 120–150 words, no jargon); Nature Physics "Research Briefing" (problem / solution / implications); Cell Press/Matter (abstract + plain-language summary box).

**Verb tense by section:**

| Section | Tense |
|---------|-------|
| Introduction (established facts) | Present |
| Introduction (prior work) | Past ("Smith et al. showed…") |
| Methods, Results | Past |
| Discussion, Conclusions | Present (outlook: future) |

Mixed tense within a section usually signals a structural problem.

---

## Level 3 — Paragraph and Sentence: flow

**Paragraph is the unit of composition** (Strunk & White). Each: tells one complete idea; opens with a topic/signposting sentence stating its point; has internal setup → development → close; connects to neighbours. If you can delete a paragraph without loss, delete it. **Diagnostic:** can you summarise each paragraph in one sentence?

**Signposting — leading sentences** orient before content arrives: background "Historically, …"; method "Our approach …"; result "These results suggest …"; contrast "By contrast, …"; building "Having established X, we …"; limitation "One limitation is …". Test: could a reader skim only first sentences and follow the argument?

**Theme–rheme (given–new):** the end of sentence N becomes the topic of N+1; given information first, new last.
> Poor: "The enzyme was purified. Column chromatography was used. Three fractions showed activity."
> Good: "The enzyme was purified using column chromatography. This procedure yielded three fractions. Each fraction showed distinct activity."

**Blank-post openers** to cut (they signal nothing): "It is important to note that…", "As mentioned earlier…", "It is clear that…", bare "Moreover/Additionally/Furthermore". Replace with the point itself.

**Sentences:** one message each; name the thing (never a vague "this advancement"); parallel grammatical form in lists ("fast, accurate, and inexpensive", not "…and has low cost"); read aloud — if you stumble, rewrite. Use all four sentence types: statement, cause-effect, contrast, comparison.

---

## Level 4 — Word: clarity

The finest polish — worth attention only once higher levels are sound. For removing AI-generated "slop" from a TreeWriter draft specifically, use **writing-deslop-basics**.

**Declutter.** Cut redundant pairs (end result → result; final conclusion → conclusion; close proximity → proximity; past history → history). Replace verbose phrases (in order to → to; due to the fact that → because; at the present time → now; make an examination of → examine; it is worth noting that → delete). Word economy — one strong word beats intensifier + weak word (very important → crucial; very rare → scarce). Prefer short Anglo-Saxon words (utilise → use; elucidate → explain; facilitate → help; demonstrate → show, unless demonstration is what happened). But unpack noun stacks: "a gelatine-dispersed multiwalled-carbon-nanotube composite film" → "a composite film of multiwalled carbon nanotubes dispersed in gelatine".

**Clarity and precision.** Avoid double negatives ("did not often succeed" → "usually failed"). Use active voice when the actor matters ("We changed the protocol", not "The protocol was changed by us"); passive is fine when the actor is irrelevant ("The sample was centrifuged at 3000 rpm"). Every "this/it/they" needs an unambiguous referent ("This reduction in variability is important", not "This is important"). Be specific: "increased significantly (p < 0.01)", not "increased a lot".

**Objectivity — explain, don't hype.**

| Hype / absolute | Measured |
|-----------------|----------|
| proves | provides evidence for / indicates |
| demonstrates (unclaimed) | suggests |
| dramatic increase | increased by 45% |
| paradigm shift / game-changing | offers a conceptually new approach |
| breakthrough technology | new method |
| will enable / solves | may enable / addresses |
| state-of-the-art | currently best-performing |
| ultra-sensitive | detection limit of 1 ppb |

Calibrate hedging to the evidence — "suggest" where evidence is strong misleads as much as "prove" where it is not. No contractions or "you"; no subjective terms (*beautiful*, *useless*). Avoid anthropomorphism (objects have no intentions): "viruses choose to remain latent" → "under non-optimal conditions, viruses remain latent"; "the method's advantage" → "the advantage of the method". Cut dead evaluative adverbs (importantly, intriguingly, remarkably) — let the finding speak.

**Hyphens, en-rules, em-rules:**

| Mark | Use | Example |
|------|-----|---------|
| Hyphen `-` | Compound modifier before a noun (dropped after) | *high-throughput screening*; "the screening was high throughput" |
| En-rule `–` | Ranges; two equal free-standing entities | *pp. 5–12*; *Bose–Einstein condensate* |
| Em-rule `—` | Parenthetical break (follow journal spacing) | *supercapacitors — that is, … — are unsuitable* |

No hyphen after an -ly adverb ("a vigorously stirred mixture"). No en-rule with "between…and" / "from…to". Prefer **-ize** (Oxford scholarly form: organize, characterize), consistently; always -ise for root words (advertise, comprise, revise, supervise).

---

## FINER — check the research question before writing

**F**easible, **I**nteresting (to the field), **N**ovel, **E**thical, **R**elevant.

---

## AI as writing companion (Trabesinger)

AI assists mechanics; the intellectual framework must come from you. You are responsible for what is written. Maintain "epistemic control" — do not outsource judgment. A useful mechanics prompt on a finished paragraph: *"Check for typos, grammatical errors, awkward phrasing, non-idiomatic wording, and double spacing."* Verify every suggestion (Gell-Mann amnesia: you catch errors where you know the subject, miss them where you do not).

---

## Grant proposals

The framework adapts: **Why** → why needed, why now, why you? **What** → your approach? **So what** → the impact? Track record and feasibility thread through the whole narrative in competitive schemes, not one section — panels assess why *this* team. Narrative CVs and fellowship statements follow the same hourglass logic.

---

## Pre-submission checklist

**Story** — statable in 4 sentences (background / however / here / so what); abstract is hourglass with a "here we show" sentence; introduction funnels general → specific; conclusions answer "so what?" without repeating results.
**Structure** — section headings descriptive; figure-caption titles summarise findings; Methods are a repeatable recipe; no new conclusions in SI; reproduction possible from text + SI + repository (with data/code availability statements).
**Paragraph** — each opens with a signposting sentence; no blank-post openers; theme–rheme chain flows; no vague referents; list items parallel.
**Word** — no redundant pairs or verbose constructions; no hype without specifics; no absolute claims without hedging; no anthropomorphism, contractions, or clichés; notation, tenses, and dashes consistent.
