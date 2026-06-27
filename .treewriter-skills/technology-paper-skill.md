---
name: technology-paper
description: Use when writing, reviewing, or revising a technology/methods/tool paper (a paper whose contribution IS a new technology, instrument, algorithm, software, assay, or device) for a Nature-family or similar high-impact venue. Triggers include "technology paper", "methods paper", "tool paper", "make the technology the star", "place in context", "conceptual advance", "direct comparison", "reproducible", "target journal fit", or any request to improve how a paper sells its technical contribution. Encodes an 8-point checklist from a Nature Portfolio editor talk on improving technology papers. Complements the multi-level scientific-writing-framework (structure/flow) by focusing on the technology-contribution narrative.
---

# Improving Technology Papers (Nature Portfolio 8-point framework)

For papers whose contribution is a **technology** (instrument, algorithm, software, assay, device, pipeline). The job is not just to describe what you built, but to convince readers it matters, beats alternatives, and can be used. Source: Nature Portfolio editorial talk, "Tips for improving technology papers."

**Core principle:** Make the technology the star, prove its advance against the state of the art, and make it usable and reproducible. A technology paper that only describes a method (without comparison, characterization, and reproducibility) reads as an engineering report, not a contribution.

---

## The 8 points

### 1. Make the technology the star
The technology is the contribution, not the application. Frame title, abstract, and figures around the technology and what it enables. Do not bury the method under the biology.
- **Check:** Could a reader name the technology and its key innovation from the title + abstract + Fig 1 alone?

### 2. Place your work in context
- What is the **state of the art**?
- How does your work take us **beyond** it?
- Why is this advance **relevant to the target journal's audience**?
- **Explicitly state the conceptual advance** (not just "we built X" but "X enables Y that was not possible").
- **Check:** Is there one sentence a reader can quote as "the conceptual advance"? Is the gap concrete (who showed what, what remains)?

### 3. Show direct comparisons
- **Quantify** how much your approach improves over alternatives (head-to-head, same data/conditions).
- Convince a **user** to switch to your approach.
- Convince a **developer** to build on it.
- Excite **clinicians / physician-scientists** to move it toward the clinic (if applicable).
- **Check:** Is there a table/figure benchmarking against the real alternatives on a shared dataset? Would each audience (user, developer, clinician) find their reason to care?

### 4. Provide quantitative characterization with pros AND cons
- Report achievable **efficiency, sensitivity, specificity** (and accuracy, speed, throughput, cost as relevant).
- Address **toxicity / failure modes / harms** where applicable.
- State the **limits of the approach** honestly.
- **Check:** Are both strengths and limits quantified? A pros-only paper invites reviewer suspicion. Are operating ranges and failure conditions given?

### 5. Choose your demonstrations wisely
- There is often a disconnect between developers and end users/clinicians. **Do not assume it is obvious why your approach is needed.**
- The best demonstrations: showcase benefits (improved diagnostics, therapeutics, or biomedical discovery), meet an **unmet need**, show **translatability**, speak to a **broad audience**, are **relevant/timely**.
- **Back up every claim** with a matching demonstration: claim pan-cancer → show multiple models; claim revolutionizes wound healing → show critical-defect healing in a large-animal model.
- **Check:** Does each headline claim have a demonstration sized to it? Are demonstrations chosen for impact and breadth, not convenience?

### 6. Make it reproducible
- "If no one can repeat it, don't bother."
- Share **schematics and protocols**.
- Share **documented, open-source code**.
- Share **realistic test data**.
- **Check:** Could a competent newcomer reproduce the result from the paper + SI + repo? Is there a data and code availability statement? (Note: balance against any IP/commercialization constraints, but state what IS available clearly.)

### 7. Explain the big picture, but be careful
- Give the broader significance and vision, but do not over-claim. Calibrate scope to evidence.
- **Check:** Does the big-picture framing stay within what the data support? Cut hype ("revolutionary", "paradigm shift") unless earned.

### 8. Read your target journals
- Have they **published in your area**? Is the **scope** a fit?
- How are **related papers structured**?
- **What did they show** (and at what level of evidence)?
- Are there **standard experiments** in those papers you have **not shown**?
- **Check:** Have you pulled 3-5 recent comparable papers from the target journal and matched their structure, evidence bar, and standard benchmarks?

---

## How to apply (audit a draft)

For each of the 8 points, score the draft **Done / Partial / Missing** and cite the specific section/line. Then:
1. List **Missing/Partial** items as the revision backlog, highest-impact first.
2. For each gap, write the specific edit or experiment needed (not a vague note).
3. Re-check that headline claims (point 5) each map to a demonstration (point 3/4) and a reproducibility artifact (point 6).

**AI prompts** (one per point): "Check whether the paper makes the technology the star in title/abstract/Fig 1." · "State this paper's conceptual advance in one sentence; is it explicit in the text?" · "List the direct comparisons; are they head-to-head on shared data?" · "List quantified pros and cons; what limits are unstated?" · "Map each headline claim to its demonstration; flag unbacked claims." · "Audit reproducibility: code, data, protocols, availability statement." · "Flag over-claims in the big-picture framing." · "Compare structure and standard experiments against 3 recent target-journal papers."

---

## Relationship to other skills
- **scientific-writing-framework** (4-level: manuscript/section/paragraph/word) handles structure, flow, hourglass, signposting. Use it for *how the prose reads*.
- **This skill** handles *how the technology is sold*: contribution framing, comparison, characterization, reproducibility, venue fit. Use both together on a technology paper.
