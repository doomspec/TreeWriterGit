# SKILL: Scientific Writing (Reinschrift Framework)

Source: Reinschrift Science Communication — AC/UofT workshop by Andreas Trabesinger
DOI: https://zenodo.org/records/18642949

---

## How to Use This Skill

When asked to write, review, or improve scientific text:
1. Identify which level(s) apply (manuscript / section / paragraph / word)
2. Apply rules for that level before moving down
3. Run the word-level checklist at the end on any finished draft
4. Use the LLM prompt at the bottom for final polish

---

## THE MULTI-LEVEL FRAMEWORK

```
Level 1 — Manuscript    → compelling narrative (story)
Level 2 — Section       → IMRAD structure, section anatomy
Level 3 — Paragraph     → coherent flow, signposting
Level 4 — Word          → clarity, precision, formality
```

Work top-down. Fix story before fixing sentences.

---

## LEVEL 1 — MANUSCRIPT: Develop Compelling Narrative

### The Core Story (3 questions)

| Question | Content |
|---|---|
| **Why?** | Background + open problems |
| **What?** | Your contribution + gap filled |
| **So what?** | Results + implications |

### Storytelling Exercise — 4 Sentences

Write these before drafting anything else:

1. **Background**: Why is this work interesting?
2. **Open questions** ("However, ..."): What are the major roadblocks?
3. **Question addressed** ("Here, ..."): What is the key contribution / gap filled?
4. **Main results and significance**: What can we do now that we could not before?

### Manuscript Hourglass Structure

```
Background (general field)
    ↓
Your story (specific contribution)
    ↓
Perspectives (broader implications, back to general)
```

**Hourglass plus**: add "in a nutshell" summary paragraph at the very top before the hourglass body (common in high-impact journals).

### Abstract = Story in Nutshell

Covers: background + gap + contribution + wider significance. Self-contained.

### Figures and Tables

Select display items that convey the story:
- **Overview figure**: shows the system/approach
- **Results + analysis figures**: substantiate claims
- **Outlook figure**: implications, future directions

Weave figures into the narrative — each figure should be called out in text with context.

### Navigability

- Descriptive (not generic) section headings
- Clear leading sentences that signal paragraph content
- Informative caption titles (not "Figure 1" — summarize the finding)

---

## LEVEL 2 — SECTION: Build Robust Structure (IMRAD)

### Section Anatomy

| Section | Purpose | Structure | Target reader |
|---|---|---|---|
| **Title** | Describe what was *found* (not what was *done*) | Concise, enticing, keywords, no acronyms/clichés | All |
| **Abstract** | Self-contained story summary | Hourglass (see formula below) | Busy reader |
| **Introduction** | Elaborate "why?", set scene | Funnel: general → specific | General reader |
| **Methods** | Enable repetition ("Recipe") | Logical sequence of steps | Expert reader |
| **Results** | Present findings | Logical sequence tied to figures | Expert reader |
| **Discussion** | Interpret, compare to prior work | Claim → evidence → context | Expert reader |
| **Conclusions** | Address "so what?" | Implications + limitations; no mere repetition | Cross-disciplinary reader |
| **References** | Credit, embed in literature | Each directly relevant, correct format | — |
| **Supplementary** | Remove reproducibility barriers ("Shopping list") | Datasets, code, extended methods | Newcomer |

**Methods rule**: put a competent person in position to repeat the study.  
**Supplementary rule**: support/substantiate main findings — no new conclusions there.

### Nature Abstract — 7-Block Formula

(Source: nature.com/documents/nature-summary-paragraph.pdf)

| Block | Colour | Length | Content |
|---|---|---|---|
| 1 | BLUE | 1–2 sentences | Basic intro accessible to any scientist |
| 2 | PURPLE | 2–3 sentences | Detailed background, related disciplines |
| 3 | YELLOW | 1 sentence | General problem / open question |
| 4 | ORANGE | 1 sentence | **Main result — must contain "here we show/present"** |
| 5 | GREEN | 2–3 sentences | What result adds vs. prior knowledge |
| 6 | WHITE | 1–2 sentences | General context / validation |
| 7 | RED | 2–3 sentences | Broader perspective (optional) |

**Word limits**: ~190 words without block 7; ~250 with block 7.

**Ultra-compact (Nature Biotechnology Brief Communication style)**: 3 sentences, ~70 words, no references.

### Introduction Funnel

```
General field
    ↓
Contextualization (why this matters)
    ↓
Existing solutions / prior work
    ↓
Best current solution
    ↓
Gap (what is still missing)
    ↓
Hypothesis / aim
    ↓
Specific contribution ("Here, we...")
```

**Signalling words**:
- Background section → "Historically,..."
- Gap → "However,..."
- Contribution → "Here, we..."

### Title Rules

**Do**: describe the finding (not the method). Include keywords. Be concise and enticing.

**Don't**: use acronyms in title; use clichés (see Level 4 clichés list).

**Title clichés to avoid**:
- Holy Grail / Silver bullet / Magic bullet
- Shedding light / Shedding new light
- Paradigm shift / Game changer / Game-changing
- Rosetta Stone / Missing link
- Breakthrough technology

### Summaries for Interdisciplinary Journals

**PNAS "Significance" section**:
Structure: Why → However → Here → So what. Short (120–150 words), no jargon.

**Nature Physics "Research Briefing"**:
Separate named sections: The problem / The solution / The implications + Expert opinion + Editorial summary + From the Editor.

**Cell Press / Matter**:
Standard abstract + separate plain-language "Summary" box.

---

## LEVEL 3 — PARAGRAPH: Write Coherent, Flowing Text

### Paragraph Rules (Strunk & White: "Make paragraph the unit of composition")

1. Each paragraph tells one complete story
2. Each paragraph has internal structure (setup → development → conclusion)
3. **First sentence signals the paragraph's point** (signposting)
4. Every paragraph earns its place: if you can delete it without loss, delete it

### Signposting — Leading Sentences

Use these to orient the reader before the content arrives:

| Context | Signal phrase |
|---|---|
| Background | "Historically,..." / "In the context of..." |
| Method | "Our approach involves..." |
| Result | "Our results indicate..." / "These results suggest..." |
| Contrast | "By contrast,..." |
| Building on earlier | "Having established X, we can demonstrate that..." |
| Conclusion | "In conclusion,..." |
| Limitation | "One limitation of this study is..." |

### Blank Posts — Avoid These Filler Openers

These add words, signal nothing:
- "It is important to note that..."
- "As we move on,..."
- "Moreover,..." / "Additionally,..." / "Furthermore,..."
- "As mentioned earlier,..."
- "It is clear that..."
- "It goes without saying that..."

Replace with a sentence that actually states the point.

### Connecting Sentences — Theme–Rheme Structure

**Rule**: end of sentence N becomes the topic of sentence N+1. Given information first, new information last.

| Bad (no flow) | Good (theme–rheme chain) |
|---|---|
| "The enzyme was purified. Column chromatography was used. Three fractions showed activity." | "The enzyme was purified using column chromatography. This procedure yielded three fractions. Each fraction showed distinct activity levels." |

**Thematic progression**: T₁→R₁, R₁ becomes T₂→R₂, etc.

### Sentence Rules

- **One sentence, one message**
- **Avoid vague referents**: never "this advancement" — name the thing explicitly
- **Parallelism**: all items in a list must share the same grammatical form
  - Bad: "The method is fast, accurate, and has low cost"
  - Good: "The method is fast, accurate, and inexpensive"
- **Read aloud** to detect flow problems — if you stumble, rewrite

### Sentence Types (use all four)

1. Statement: "X is Y."
2. Cause-effect: "X causes Y because Z."
3. Contrast: "X increases, whereas Y decreases."
4. Comparison: "X performs similarly to Y."

---

## LEVEL 4 — WORD: Ensure Clarity

### 4a. Decluttering

**Aim for minimum complexity possible.**

**Remove redundancy** (second word adds nothing):

| Redundant | Fixed |
|---|---|
| personal friend | friend |
| future prospect | prospect |
| solid facts | facts |
| final conclusion | conclusion |
| end result | result |
| close proximity | proximity |

**Replace verbose phrases**:

| Verbose | Concise |
|---|---|
| in the not-too-distant future | soon |
| at the present time / at this point in time | now / currently |
| in the light of the fact that | because |
| concerning the nature of | about |
| make an examination of | examine |
| present a comparison of | compare |
| be in agreement | agree |
| perform an analysis of | analyse |
| produce an improvement in | improve |
| it is important to emphasize | (delete) |
| it is widely accepted that | (delete or cite) |
| it is worth noting/mentioning that | (delete) |

**Word economy** — replace weak intensifier + common word with one strong word:

| Weak | Strong |
|---|---|
| very important | crucial / critical / essential |
| very common | omnipresent / pervasive |
| very rare | scarce / unique / exceptional |
| pretty/quite/rather [adjective] | (same strong synonyms) |

**Replace long Latinate words**:

| Long | Short |
|---|---|
| efficacious | effective |
| utilize | use |
| elucidate | explain |
| proximal | close |
| facilitate | help / enable |
| demonstrate | show |
| endeavour | try |

**But: unpack noun stacks** — long chains of nouns are harder to read than relative clauses:
- Bad: "a gelatine dispersed multiwalled carbon nanotube composite film"
- Good: "a composite film made of multiwalled carbon nanotubes dispersed in gelatine"

### 4b. Clarity and Precision

**Avoid ambiguity** — especially double negatives:
- Bad: "The algorithm did not often succeed in..."
- Good: "The algorithm usually failed to..."

**Avoid excessive passive** — passive hides the actor; use active when the actor matters:
- Bad: "The protocol was changed by us such that..."
- Good: "We changed the protocol such that..."
- OK: "The sample was centrifuged at 3000 rpm" (actor irrelevant)

**Avoid vague referents** — replace pronouns/demonstratives with specific nouns:
- Bad: "This is important because..."
- Good: "This reduction in variability is important because..."

**Hyphens matter** for compound modifiers before nouns:
- "boron containing carbon" ≠ "boron-containing carbon"
- "high throughput screening" → "high-throughput screening"
- Rule: hyphenate compound modifier *before* noun; not needed *after* noun ("the screening was high throughput")

### 4c. Objectivity and Formality

**Explain, don't hype** — replace overstatement with measured claims:

| Hype | Measured |
|---|---|
| proves | provides evidence for / supports / indicates |
| dramatic increase | increased by 45% |
| extremely significant | statistically significant (p < 0.001) |
| paradigm shift | challenges current models |
| game-changing | offers a conceptually new approach |
| breakthrough technology | new method / novel technique |

**Replace absolute claims with appropriate hedging**:

| Absolute | Hedged |
|---|---|
| demonstrates | suggests (when appropriate) |
| will enable | may enable / could facilitate |
| solves the problem | addresses the challenge |
| perfect agreement | good agreement (R² = 0.95) |

**Replace vague superlatives with specific descriptions**:

| Vague | Specific |
|---|---|
| enormous potential | potential applications in ... |
| vastly superior | outperforms by 30% |
| highly novel | novel, not previously reported; differs from previous approaches |
| state-of-the-art | currently best-performing / highest-sensitivity |
| ultra-sensitive | detection limit of 1 ppb |

**Avoid informal style**:
- No "you" or contractions (*isn't*, *hasn't*, *there's*)
- No subjective terms (*beautiful*, *useless*)
- Avoid borderline informal connectors: *besides*, *plus*, *still* (as sentence opener)

**Avoid anthropomorphisms** — objects don't have intentions:

| Anthropomorphism | Fixed |
|---|---|
| certain proteins are in need of... | processing of certain proteins requires... |
| yeast strain X preferred YPG as a growth medium | the fastest growth rate for yeast strain X was recorded for... |
| viruses choose to remain latent when conditions are not optimal | under non-optimal conditions, viruses remain latent |
| this spin plays an important role in this process | this spin has an important role in this process |
| The method's advantage | The advantage of the method |

**Avoid clichés** (see also Title clichés above):
- Holy Grail, Silver bullet / Magic bullet
- Shedding light, Missing link
- Paradigm shift, Rosetta Stone
- State-of-the-art (use "currently best-performing" instead)

**Avoid overused academic phrases**:
- "at this point in time" → now
- "it is widely accepted that" → (cite it or cut it)
- "it is worth noting/mentioning that" → (cut; just say it)
- "importantly, intriguingly, interestingly, remarkably, strikingly" → (cut the adverb; let the finding speak)
- "further research is needed" → (specify what research, or cut)

### 4d. Checkpoints — Final Scan

Before submitting, scan for:
- [ ] **Consistent notation** — symbols, abbreviations, units defined once and used consistently
- [ ] **Hyphens / en-rules / em-rules** — correct usage (see table below)
- [ ] **Verb tenses** — consistent within sections (see tense guide below)

---

## TENSE GUIDE BY SECTION

| Section | Typical tense | Rationale |
|---|---|---|
| **Methods** | Past | Actions were performed |
| **Results** | Past | Data were collected |
| **Discussion** | Present | Interpretation is current knowledge |
| **Conclusions** | Future | Implications and outlook |
| **Introduction** (established facts) | Present | Still true |
| **Introduction** (prior work) | Past | It was done then |

Example showing all three in sequence:
> "The experiment *was carried out* in a sterile environment. [Result — past] It *is* particularly important to avoid contamination. [Discussion — present] It *will be* necessary to ensure that the same conditions are replicated in future experiments. [Conclusion — future]"

---

## HYPHENS, EN-RULES, EM-RULES

| Mark | Symbol | Use | Examples |
|---|---|---|---|
| Hyphen | - | Compound modifier before noun; compound words | *high-throughput study*, *non-equilibrium*, *best-case scenario*, *an eight-year-old boy* |
| En-rule | – | Two equal entities; ranges | *air–water interface*, *Bose–Einstein condensate*, *Shan–Chen method*, *pages 5–12*, *east–west*, *chapters 8–12* |
| Em-rule | — | Break in thought; parenthetical insertion | *supercapacitors — that is, ... — are not suitable* |

**No en-rule** with "between...and" or "from...to":
- "the period between 1994 and 1999" — no en-rule
- "president from 1994 to 1999" — no en-rule

**No hyphen** after adverb ending in -ly:
- "a vigorously stirred mixture" — no hyphen
- "an unusually homogeneous mixture" — no hyphen

---

## FINER RESEARCH QUESTION CHECKLIST

Before writing, verify your research question is:
- **F**easible — can be done with available resources/time
- **I**nteresting — to the field, not just you
- **N**ovel — not already answered
- **E**thical — passes ethical review
- **R**elevant — connects to broader scientific or practical questions

---

## LLM DECLUTTER PROMPT

After drafting, run this prompt on any paragraph:

> "Can you please carefully check for typos, grammatical errors, awkward phrasing, non-idiomatic wording and double spacing?"

**Note**: LLM assists mechanics; intellectual framework must come from you. Verify all LLM suggestions — apply the Gell-Mann amnesia test: if you know the subject, you can spot errors; the same errors occur in areas you don't know but can't detect there.

**AI as writing companion principles** (Trabesinger):
- Content and clarity matter; not aesthetic virtuosity
- AI can assist mechanics; intellectual framework must come from you
- You are responsible for what is written
- Text is consumed by humans, not AI
- Maintain "epistemic control" — don't outsource judgment (arxiv.org/abs/2601.12740)
- Need solid grounding in subject and language to interact meaningfully with AI

---

## QUICK CHECKLIST (pre-submission)

### Story check
- [ ] Can state the story in 4 sentences (background / however / here / so what)?
- [ ] Abstract follows hourglass with "here we show/present" sentence?
- [ ] Introduction funnels from general to specific?
- [ ] Conclusions address "so what?" without repeating results verbatim?

### Structure check
- [ ] Each section heading is descriptive (not generic)?
- [ ] Each figure has an informative caption title (summarizes finding)?
- [ ] Methods written as recipe — competent person could repeat?
- [ ] No new conclusions in supplementary?

### Paragraph check
- [ ] Each paragraph opens with a signposting sentence?
- [ ] No blank-post openers (Moreover, Additionally, It is important to note)?
- [ ] Theme–rheme chain flows through consecutive sentences?
- [ ] No vague referents ("this", "these advancements")?
- [ ] All list items parallel in grammatical form?

### Word check
- [ ] No redundant word pairs?
- [ ] No verbose multi-word constructions?
- [ ] No hype vocabulary (proves, dramatic, breakthrough, state-of-the-art without specifics)?
- [ ] No absolute claims without hedging (demonstrates, will enable, solves)?
- [ ] No anthropomorphisms?
- [ ] No contractions or "you"?
- [ ] No title/text clichés (Holy Grail, Silver bullet, Shedding light, etc.)?
- [ ] Notation consistent throughout?
- [ ] Tenses correct by section?
- [ ] Hyphens / en-rules / em-rules correct?

---

*Reinschrift Science Communication — Andreas Trabesinger (AC/UofT workshop, Day 1)*
*DOI: https://zenodo.org/records/18642949*
