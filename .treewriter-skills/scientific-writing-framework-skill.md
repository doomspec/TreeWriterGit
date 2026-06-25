---
name: scientific-writing-framework
description: Use this skill whenever the user wants to analyse, review, or improve scientific writing using the multi-level framework. Triggers include mentions of "scientific writing", "manuscript review", "framework", references to manuscript/section/paragraph/word levels, requests to check narrative structure (why/what/so what), abstract quality, thematic progression, signposting, or any manuscript editing where systematic analysis would help. Also use when the user mentions "hourglass structure", asks about story arc in a paper, or wants feedback on grant proposals, papers, or theses. This skill encodes a comprehensive pedagogical framework developed through university teaching and decades of editing experience.
---

# Multi-Level Framework for Scientific Writing

A systematic framework for analysing, writing, and editing scientific manuscripts. The framework operates at four hierarchical levels, from broadest scope to finest detail.

**Core principle**: Work top-down for writing, bottom-up for editing. Fix structural problems before polishing words.

---

## The Four Levels

| Level | Focus | Key Questions |
|-------|-------|---------------|
| **Manuscript** | Story arc, overall narrative | Why? What? So what? |
| **Section** | Structure and function of each part | Does each section do its job? |
| **Paragraph/Sentence** | Flow, coherence, signposting | Is the logic visible and connected? |
| **Word** | Economy, precision, formality | Is every word earning its place? |

---

## Level 1: Manuscript

The manuscript level concerns the overall story and how it's conveyed to different readers.

### Story Structure: Why? / What? / So what?

Every scientific paper must answer three questions:

1. **Why?** — What is the problem, gap, or motivation?
2. **What?** — What did you do? What did you find?
3. **So what?** — Why does it matter? What are the implications?

**Diagnostic questions:**
- Can you articulate the paper's story in three sentences (why/what/so what)?
- Is the "so what" compelling and specific, not generic?
- Does the narrative thread run clearly from introduction through discussion?

### Abstract Quality

The abstract must be self-contained and tell the complete story in miniature.

**Check:**
- Does it follow the hourglass structure (broad → narrow → broad)?
- Can a non-specialist grasp the significance?
- Are the main findings stated, not just hinted at?

### Figure Strategy

Figures are often the first thing readers examine.

**Check:**
- Can you understand the paper's main message from figures alone?
- Does each figure have a clear purpose in the narrative?
- Are figures referenced at appropriate points in the text?

### Reader Hierarchy

Different readers engage at different depths:

| Reader Type | What They Read | What They Need |
|-------------|----------------|----------------|
| Quick reader | Title, abstract, figures | Complete story in compressed form |
| General reader | + Introduction, conclusions | Context and significance |
| Specialist | Full text | Methods, details, nuance |

**Check:** Does each level work for its intended reader?

**A useful additional test:** can a *newcomer to the subfield* — typically a first-year PhD student or a talented MSc student — use the SI to reproduce the work? The SI should contain everything specific to this paper that is not available elsewhere: detailed protocols, parameters, derivations, code, and data. Standard background knowledge belongs in textbooks and the literature; paper-specific knowledge belongs in the SI.

---

## Level 2: Section

Each major section has a specific function. Evaluate whether it fulfils that function.

### Title

- Is it specific and informative?
- Does it convey the main finding or contribution?
- Avoid: generic titles, question titles (usually), overly clever titles

### Abstract

Structure (hourglass):
1. **Opening** — Broad context, why this matters
2. **Background** — More specific context, state of the field
3. **Gap/Problem** — What's missing, what's the question
4. **"Here we..."** — The pivot from problem to solution. This statement marks the transition from what is missing to what this paper delivers. It should be specific enough that a reader could reconstruct the paper's core contribution from it alone. Everything before it establishes why the paper is needed; everything after it is the payoff.
5. **Key findings** — Main results, stated clearly
6. **Implications** — So what? Broader significance

**Common failure mode — the grant-proposal abstract:**
In high-level physics and Nature-family journals, a frequent error is an abstract structured as: broad field context → methodological approach → vague gesture at results. This reads like a grant proposal and buries the finding. The corrective is to lead with the result (or at minimum, the surprise), and use the "Here we…" pivot to introduce the approach. Ask: *could a reader state the main finding after reading only the abstract?* If not, the abstract needs restructuring.

### Introduction

Function: Lead the reader from broad context to your specific question.

**Check:**
- Does it establish the gap in knowledge?
- Is the "funneling" smooth (broad → narrow)?
- Does it end with a clear statement of what this paper will do?
- Is it appropriately concise?

### Methods

- Sufficient detail for reproduction?
- Logical organization (sequential by experimental procedure, or grouped by technique)?

### Supplementary Material

Supplementary Material (SI) extends the main text without disrupting its flow. Use it for:
- Methodological detail beyond what the main Methods section can accommodate while remaining readable
- Extended figures, tables, and derivations that support but do not drive the main narrative
- Raw or processed datasets
- Code and analysis scripts

**Check:**
- Is everything needed to reproduce the results available — either in the main text, the SI, or a linked repository?
- Are datasets deposited in an appropriate repository (e.g. Zenodo, Figshare, institutional repository)?
- Is code available in a version-controlled repository (e.g. GitHub, GitLab) with sufficient documentation to run it?
- Is there a data availability statement, and if required by the journal, a code availability statement?
- Does the SI have its own internal logic, or is it a dumping ground? Reviewers and careful readers will read it.

### Results

Each results paragraph should have a clear narrative function:
- Open by stating the question or observation the paragraph addresses
- Present the evidence or finding
- Close by signposting the connection to what follows

**Check:**
- Is the logic between consecutive observations made explicit, or does the reader have to infer it?
- Are paragraphs presenting data, or are they telling a story with data as evidence?
- Is the main finding of each paragraph clear from its opening sentence?
- Figures and tables placed appropriately?
- Clear connection between methods and results?
- Are placeholders, incomplete passages, and author notes removed before submission?

**A common failure mode:** results paragraphs that describe what a figure shows rather than what the data mean. The figure caption does the former; the results text should do the latter. Each paragraph should make a scientific statement and use the figure as evidence, not narrate its contents.

### Discussion

Function: Interpret results, address limitations, connect to broader context.

**Check:**
- Does it open with the main finding, framed in terms of its interpretation or significance — not merely restating what was observed? The opening sentence of the Discussion should advance the reader's understanding, not replay the Results section.
- Are alternative explanations considered?
- Are limitations acknowledged honestly?
- Does it connect findings to the field (funnel back out)?

### Conclusions

- Specific to this work, not generic statements?
- Forward-looking where appropriate?
- No new story elements introduced?

### Verb Tense by Section

Different sections use different tenses by convention:

| Section | Tense | Rationale |
|---------|-------|-----------|
| Introduction | Present | Established knowledge is treated as current fact |
| Methods | Past | Describes what was done |
| Results | Past | Describes what was found |
| Discussion | Present | Interprets findings in relation to current knowledge |
| Conclusions | Present | States what is now known |

**Note:** Within the Introduction, prior work is often referenced in past tense ("Smith et al. showed…"), switching to present for the accepted state of knowledge ("It is now understood that…"). Mixed tense within a section usually signals a structural problem.

---

## Level 3: Paragraph and Sentence

This level concerns flow, coherence, and the logical structure of argument.

### Paragraph Structure

Each paragraph should:
- Have a **clear role** in the argument
- Open with a **topic sentence** stating its main point
- Contain **one main idea** (the "paragraph = unit of thought" principle)
- Connect logically to the previous and next paragraphs

**Diagnostic:** Can you summarise each paragraph in one sentence? If not, it may need splitting or refocusing.

### Signposting

Signposts guide readers through the argument:
- Transitions between paragraphs ("However", "In contrast", "Building on this")
- Section openings that preview content
- Explicit statements of structure ("We address three questions...")

**Check:** Could a reader skim only the first sentence of each paragraph and follow the argument?

### Thematic Progression

Sentences should connect logically through **given–new structure**:
- Each sentence picks up an element from the previous sentence (given)
- Each sentence introduces new information (new)
- The "new" of one sentence often becomes the "given" of the next

**Example of poor flow:**
> "The enzyme was purified. Column chromatography was used. Three fractions showed activity."

**Example of good flow:**
> "The enzyme was purified using column chromatography. This procedure yielded three fractions. Each fraction showed distinct activity levels."

### One Message per Sentence

- Avoid overloaded sentences with multiple clauses
- Split complex ideas across multiple sentences
- The reader should grasp your point on first reading

### Decluttering

Remove:
- Redundant phrases ("in order to" → "to")
- Weak openings ("It is important to note that...")
- Excessive hedging (but keep appropriate hedging)
- Unnecessary nominalizations ("make a measurement" → "measure")

---

## Level 4: Word

The finest level of polish — but only worth attention once higher levels are sound.

### Economy

- Use short words where they work as well as long ones
- Cut words that add no meaning
- Prefer active voice (usually)

| Wordy | Concise |
|-------|---------|
| in order to | to |
| due to the fact that | because |
| a large number of | many |
| at the present time | now |
| in the event that | if |
| it is possible that | perhaps / may |

### Clarity and Precision

- Use precise technical terms correctly
- Avoid ambiguous pronouns (unclear "this", "it", "they")
- Define acronyms on first use
- Be specific: "increased significantly (p < 0.01)" not "increased a lot"

### Hedging and Certainty

Calibrate the strength of claims precisely to what the evidence supports. Under-hedging overstates; over-hedging undermines the contribution.

| Stronger claim | Weaker claim |
|----------------|--------------|
| prove, demonstrate | suggest, indicate |
| show | appear to show |
| confirm | are consistent with |
| the data establish | the data are compatible with |

**Check:** Is every claim in the paper at the right point on this spectrum? "Suggest" where the evidence is strong is as misleading as "prove" where it is not.

### Objectivity and Formality

Scientific writing should be:
- Objective (focus on evidence, not feelings)
- Formal (appropriate register for academic audience)
- Cautious where appropriate ("suggests" vs. "proves")

**Avoid:**
- Hyperbole ("groundbreaking", "revolutionary")
- Colloquialisms
- First person where it draws attention from the work

### Crutch Phrases

Certain phrases recur so frequently in scientific writing that they have lost communicative force. Flag and replace them.

**Vague evaluative language** — these tell the reader how to feel rather than showing why the result matters:
"intriguing", "fascinating", "exciting", "elegant", "remarkable", "striking", "notable". Replace with a specific statement of *why* the finding is significant.

**Introduction crutches:**
"in recent years", "over the past decades", "has been extensively studied", "is receiving great interest", "plays an important role in science and technology". These substitute for genuine contextualization. State specifically what has been established, by whom, and what remains open.

**Conclusion crutches:**
"further research is needed", "opens new avenues", "paves the way for", "sheds light on", "lays the groundwork for", "provides a platform for". These are placeholders for a genuine forward-looking statement. Say specifically what the next step is, or what question this work now makes answerable.

**Redundancies:**
"past history", "future plans", "completely eliminate", "still remains", "end result", "brief summary", "absolutely essential". Cut the redundant word.

### Non-Native-Speaker Patterns

Many manuscripts written by non-native English speakers share characteristic constructions that a careful editor will flag. The most common:

**Filler phrases** — wordy constructions with leaner equivalents:

| Wordy | Concise |
|-------|---------|
| in order to | to |
| due to the fact that | because |
| in the case of | for |
| with regard/respect to | on, about |
| in terms of | (often deletable) |
| it can be seen that | (delete; state the observation directly) |
| on the other hand | (only valid if "on the one hand" appeared earlier) |

**Stiff or over-Latinate constructions** — where simpler phrasing would serve equally well. Prefer short Anglo-Saxon words where they carry the same meaning: "use" not "utilise", "show" not "demonstrate" (unless demonstrating is specifically what was done), "find" not "identify" where no identification process is implied.

**Vague referents** — unclear use of "this", "it", or "they" without an unambiguous antecedent. Every demonstrative should have a referent the reader can identify without re-reading.

### Hyphens, en-dashes, and em-dashes

These three are frequently confused.

**Hyphens** (-) join compound modifiers before a noun ("high-resolution image", "well-established method") but are dropped when the modifier follows the verb ("the image is high resolution"). Also used in prefixes where needed for clarity ("re-examine", "co-author").

**En-dashes** (–) are used for ranges ("pp. 10–25", "2019–2023") and for compound terms where the elements are of equal weight and both are free-standing ("Bose–Einstein condensate", "cost–benefit analysis").

**Em-dashes** (—) mark a parenthetical aside or a strong break in a sentence. Spacing conventions vary by house style; follow the target journal.

**Check:** Are hyphens, en-dashes, and em-dashes used consistently and correctly throughout? Inconsistent dash usage is a common copy-editing flag.

### -ize/-ise spellings

*New Hart's Rules* endorses **-ize** spellings as the preferred Oxford scholarly convention ("organize", "recognize", "characterize"). This is not an Americanism — it is the historically established form and the standard in most major academic publishers. The -ise spelling is a common alternative but should not be used interchangeably with -ize within the same document.

Exceptions that are always -ise regardless of house style: "advertise", "advise", "comprise", "revise", "supervise", and others where -ise is part of the root, not a suffix.

**Check:** Are -ize/-ise spellings consistent throughout? Follow the house style of the target journal where specified.

---

## Using the Framework

### For Writing (Top-Down)

1. **Start at manuscript level**: Articulate your story (why/what/so what)
2. **Plan sections**: Outline each section's purpose and content
3. **Draft paragraphs**: Write topic sentences first, then fill in
4. **Polish words**: Only after structure is sound

### For Editing (Bottom-Up)

1. **Word level**: Fix obvious errors, tighten prose
2. **Sentence/Paragraph level**: Check flow, signposting, paragraph unity
3. **Section level**: Verify each section fulfils its function
4. **Manuscript level**: Step back — does the story work?

### For AI-Assisted Writing

Each cell in the framework converts to an AI prompt. Prefix with:
- "Check whether..."
- "Help me ensure..."
- "Analyse this text for..."

**Examples:**
- "Check whether my abstract follows the hourglass structure"
- "Help me ensure each paragraph has a clear topic sentence"
- "Analyse this introduction for gap identification"

---

## Quick Reference Checklist

### Manuscript Level
- [ ] Story is clear: why / what / so what
- [ ] Abstract is self-contained and complete
- [ ] Figures tell the story independently
- [ ] Narrative thread runs throughout

### Section Level
- [ ] Title is specific and informative
- [ ] Introduction funnels from broad to specific
- [ ] Methods enable reproduction
- [ ] Results presented objectively
- [ ] Discussion interprets without over-claiming
- [ ] Conclusions are specific, not generic

### Paragraph/Sentence Level
- [ ] Each paragraph has one main idea
- [ ] Topic sentences are clear
- [ ] Signposting guides the reader
- [ ] Thematic progression connects sentences
- [ ] No overloaded sentences

### Word Level
- [ ] Prose is concise
- [ ] Technical terms used precisely
- [ ] No ambiguous pronouns
- [ ] Appropriate formality and hedging

---

## Application Notes

### For Manuscript Editing

When reviewing a manuscript systematically:
1. Read once for overall impression (manuscript level)
2. Check each section against its function (section level)
3. Analyse paragraph structure and flow (paragraph level)
4. Polish language only after structure is sound (word level)

### For Grant Proposals

The framework applies with adaptation:
- **Why** becomes: Why is this research needed? Why now? Why you?
- **What** becomes: What will you do? What is your approach?
- **So what** becomes: What will the impact be?

**Track record and feasibility** thread through the entire narrative in competitive grant schemes, not just in a designated section. Panels assess not only *what* will be done and *why it matters*, but *why this PI/team is the one to do it*. The same manuscript-level question — "so what?" — applies here to the applicant's positioning: why now, why this approach, why you? Note that narrative CVs and fellowship statements follow many of the same structural principles as grant proposals, with similar hourglass logic and story arc.

### For Teaching

The framework supports progressive disclosure:
- Introduce levels sequentially
- Use exemplar texts at each level
- Have students diagnose texts before revising
- Build from manuscript-level thinking downward

---

## References and Resources

- Published on Zenodo: DOI [10.5281/zenodo.18148137](https://doi.org/10.5281/zenodo.18148137)
- The framework document is licensed CC BY-SA 4.0 — free to use, adapt, and share with attribution
