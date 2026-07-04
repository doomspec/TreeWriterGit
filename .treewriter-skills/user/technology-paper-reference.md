---
name: technology-paper-reference
description: Reference detail for technology-paper skill — Nature Portfolio 8-point framework, Cellpose-family pattern baseline, audit prompts. Not loaded unless explicitly enabled.
---

# Technology Paper Reference

Use with `technology-paper-skill.md`. This file holds the full 8-point checklist, audit workflow, and Cellpose-family pattern baseline.

---

## The 8 points (full)

### 1. Make the technology the star
The technology is the contribution, not the application. Frame title, abstract, and figures around the technology and what it enables.
- **Check:** Could a reader name the technology and its key innovation from the title + abstract + Fig 1 alone?

### 2. Place your work in context
- What is the **state of the art**?
- How does your work take us **beyond** it?
- Why is this advance **relevant to the target journal's audience**?
- **Explicitly state the conceptual advance** (not just "we built X" but "X enables Y that was not possible").

### 3. Show direct comparisons
- **Quantify** improvement over alternatives (head-to-head, same data/conditions).
- Convince a **user** to switch, a **developer** to build on it, and (if applicable) **clinicians** to move it toward the clinic.

### 4. Provide quantitative characterization with pros AND cons
- Report efficiency, sensitivity, specificity, accuracy, speed, throughput, cost as relevant.
- Address failure modes and state **limits** honestly.

### 5. Choose your demonstrations wisely
- Back up every headline claim with a matching demonstration sized to it.
- Prefer demonstrations that meet an unmet need and speak to a broad audience.

### 6. Make it reproducible
- Share schematics, protocols, documented open-source code, and realistic test data.

### 7. Explain the big picture, but be careful
- Give broader significance without over-claiming. Cut hype unless earned.

### 8. Read your target journals
- Pull 3–5 recent comparable papers; match structure, evidence bar, and standard benchmarks.

---

## Audit workflow

For each of the 8 points, score the draft **Done / Partial / Missing** and cite the section. Then:
1. List Missing/Partial items as revision backlog, highest-impact first.
2. For each gap, write the specific edit or experiment needed.
3. Re-check that headline claims map to demonstrations and reproducibility artifacts.

**One prompt per point:** "Check whether the paper makes the technology the star in title/abstract/Fig 1." · "State the conceptual advance in one sentence; is it explicit?" · "List direct comparisons; head-to-head on shared data?" · "List quantified pros and cons; unstated limits?" · "Map each headline claim to its demonstration." · "Audit reproducibility: code, data, protocols." · "Flag over-claims in big-picture framing." · "Compare against 3 recent target-journal papers."

---

## Cellpose-family pattern baseline

When shaping a tool paper to read like the Cellpose family (2021 / 2.0 / 2025):

**Core judgment:** technology is the star first; demonstrations prove why it matters. Headline = platform contribution, not a secondary pilot study.

**8-point pattern:** (1) technology-first title/abstract; (2) gap vs existing tools; (3) one central conceptual advance; (4) mechanism section early; (5) direct comparison as core result; (6) adaptation/generalization block; (7) usability/reproducibility as contribution; (8) discussion returns to what the technology changes.

**Results ladder:** accuracy benchmark → human concordance → workflow value → generalization/adaptation → interface/operationalization.

**Apply:** abstract's strongest claim = technology capability; Results follow the ladder; limits integrated in Results, not only Discussion.
