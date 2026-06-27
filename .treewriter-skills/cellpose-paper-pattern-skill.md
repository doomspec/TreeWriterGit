---
name: cellpose-paper-pattern
description: Use when shaping a technology/tool/methods paper to follow the Cellpose paper family's proven writing pattern, or when comparing a draft against that baseline. Triggers include "cellpose voice", "cellpose pattern", "cellpose comparison", "make the technology the star", "technology-first abstract", "is the technology the headline", "compare to cellpose", or any request to make a tool paper read like Cellpose / Cellpose 2.0 / Cellpose-SAM. Encodes the 8-point writing pattern and the Results ladder distilled from the three Cellpose papers. Complements technology-paper (Nature Portfolio 8-point checklist) and scientific-writing-framework (structure/flow).
---

# Cellpose-family technology-paper writing pattern

A distillation of the consistent writing pattern across the three Cellpose papers (Cellpose 2021, Cellpose 2.0 2022, Cellpose-SAM 2025), used as a baseline for shaping a tool/technology paper. Apply alongside `technology-paper` (contribution framing) and `scientific-writing-framework` (structure/flow).

## Core judgment to enforce

Make the **technology the star first**, then use demonstrations to prove why it matters. A tool paper fails when it lets a secondary study (e.g. a reproducibility/operator study) act as the main story instead of the proof-of-value story. The strongest headline should be the platform/technology contribution, not a pilot-scale statistical result. Mark anything underpowered as directional, not as the headline.

## The 8-point pattern

1. **Technology-first title and abstract.** Title names the tool and the core advance. Abstract states bottleneck → tool → mechanism → quantitative payoff.
2. **Gap framed against existing tools.** Existing methods limited by specialization, poor generalization, or no adaptation. The gap is concrete and technical, not generic.
3. **One central conceptual advance.** State a single sharp advance (e.g. generalist segmentation; user adaptation / HITL retraining; out-of-distribution generalization via foundation-model pretraining). Not a list of features.
4. **System/mechanism section early.** The reader sees how the model works before being asked to trust performance claims.
5. **Direct comparison as a core result, not a side note.** Benchmarks are central; baselines are task-matched; quantitative performance is presented as evidence for the technology claim.
6. **Adaptation/generalization gets its own result block.** Separate "how accurate is it?" from "how broadly/flexibly does it work?"
7. **Usability/reproducibility is part of the contribution.** GUI, model zoo, HITL loop, deployability are enabling features, not supplementary conveniences.
8. **Discussion returns to what the technology changes.** Interpret results in terms of tool value, limits, and future use.

## Recommended Results ladder

Order Results as an escalating, single benchmark story, not a mixed middle:

1. **Technology accuracy benchmark** (detection/segmentation vs task-matched model baselines).
2. **Human concordance and error sources** (model vs human; where the residual difficulty lives).
3. **Workflow value to users** (speed, standardization; mark significant vs directional explicitly).
4. **Generalization and adaptation in practice** (transfer beyond training condition; correction/retraining burden).
5. **Interface and operationalization** (GUI, QC; why it is usable in routine work).

## Whole-paper logic

gap → technology → mechanism → direct benchmark → user-value demonstration → transfer/adaptation demonstration → calibrated significance.

## How to apply to a draft

- Check the abstract: does its strongest quantitative claim describe the technology capability, or a secondary study? Move the technology to the front.
- Check Results order against the ladder above; if benchmark, human study, and workflow study are interleaved, separate them into the four questions: Is it accurate enough? Does it agree with humans? Does it make users faster/more standardized? Does it transfer beyond training?
- Check that limits are integrated into Results interpretation, not only swept into the Discussion.
- Check the Discussion opens on the interpreted platform contribution, then transformer/HITL value, then pilot data, then limits, then future path.

A worked, project-specific application of this pattern (VibeCount vs the Cellpose family, point by point) lives in the manuscript repo at `refs/deeppapernote/notes/vibecount-technology-paper-outline-comparison.md`.
