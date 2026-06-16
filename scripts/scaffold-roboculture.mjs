#!/usr/bin/env node
/**
 * scaffold-roboculture.mjs
 * Creates model/papers/roboculture/ from the arXiv-2505.14941v2 LaTeX source.
 * Run: node scripts/scaffold-roboculture.mjs [/path/to/extracted/tar]
 *
 * Default source: /tmp/roboculture
 */

import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const modelRoot = path.join(repoRoot, "model");
const src = process.argv[2] ?? "/tmp/roboculture";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function fm(data, body = "") {
  const lines = ["---"];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + (body ? body.trimStart() + "\n" : "");
}

/** Strip LaTeX figure/table environments and clean up for readable draft. */
function latexToReadableDraft(tex) {
  return tex
    .replace(/\\begin\{figure\*?\}[\s\S]*?\\end\{figure\*?\}/g, "")
    .replace(/\\begin\{table\*?\}[\s\S]*?\\end\{table\*?\}/g, "")
    .replace(/\\begin\{algorithm\}[\s\S]*?\\end\{algorithm\}/g, "")
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\ref\{[^}]*\}/g, "")
    .replace(/\\cite\{([^}]+)\}/g, (_, k) => `[@${k}]`)
    .replace(/\\textbf\{([^}]+)\}/g, "**$1**")
    .replace(/\\textit\{([^}]+)\}/g, "_$1_")
    .replace(/\\emph\{([^}]+)\}/g, "_$1_")
    .replace(/\\section\*?\{([^}]+)\}/g, "## $1")
    .replace(/\\subsection\*?\{([^}]+)\}/g, "### $1")
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, "#### $1")
    .replace(/\\paragraph\*?\{([^}]+)\}/g, "**$1**")
    .replace(/\\begin\{enumerate\}/g, "")
    .replace(/\\end\{enumerate\}/g, "")
    .replace(/\\begin\{itemize\}/g, "")
    .replace(/\\end\{itemize\}/g, "")
    .replace(/\\item\s*/g, "- ")
    .replace(/\\href\{[^}]*\}\{([^}]+)\}/g, "$1")
    .replace(/\\url\{([^}]+)\}/g, "$1")
    .replace(/\\\\\s*/g, "")
    .replace(/\$([^$]+)\$/g, "`$1`")
    .replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, "")
    .replace(/\\[a-zA-Z]+\*?(\s|$)/g, "")
    .replace(/\{|\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readTex(filename) {
  try {
    return await readFile(path.join(src, "tex", filename), "utf8");
  } catch {
    return "";
  }
}

async function makeUnit(relPath, idea, links = [], draft = "") {
  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) await mkdir(abs, { recursive: true });
  const index = fm(
    { kind: "unit", title: relPath.split("/").at(-1).replace(/-/g, " "), status: "draft", links },
    `# ${relPath.split("/").at(-1).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}\n\n${idea}`,
  );
  await writeFile(path.join(abs, "INDEX.md"), index, "utf8");
  await writeFile(path.join(abs, "draft.md"), draft, "utf8");
  console.log("  unit:", relPath);
}

async function makeSection(relPath, title, childOrder, idea = "") {
  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) await mkdir(abs, { recursive: true });
  const index = fm(
    { kind: "section", title, child_order: childOrder },
    `# ${title}\n\n${idea || `_Outline / narrative arc for the ${title} section._`}`,
  );
  await writeFile(path.join(abs, "INDEX.md"), index, "utf8");
  console.log("section:", relPath);
}

async function makePaper(relPath, meta, sectionOrder, body = "") {
  const abs = path.join(modelRoot, relPath);
  if (!existsSync(abs)) await mkdir(abs, { recursive: true });
  const index = fm({ kind: "paper", ...meta, section_order: sectionOrder }, body);
  await writeFile(path.join(abs, "INDEX.md"), index, "utf8");
  console.log("  paper:", relPath);
}

// ──────────────────────────────────────────────
// LaTeX → content extraction
// ──────────────────────────────────────────────

function extractSection(tex, sectionName, nextSectionName) {
  const start = tex.indexOf(sectionName);
  if (start === -1) return "";
  const end = nextSectionName ? tex.indexOf(nextSectionName, start + sectionName.length) : tex.length;
  return tex.slice(start, end === -1 ? undefined : end);
}

function extractSubsection(tex, subsectionName) {
  const pattern = new RegExp(
    `\\\\subsection\\*?\\{[^}]*${subsectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^}]*\\}([\\s\\S]*?)(?=\\\\subsection|\\\\section|$)`,
    "i",
  );
  const m = tex.match(pattern);
  return m ? m[1] : "";
}

// ──────────────────────────────────────────────
// Main scaffold
// ──────────────────────────────────────────────

async function main() {
  console.log("Scaffolding RoboCulture from:", src);
  console.log("Model root:", modelRoot);

  const introTex = await readTex("Introduction.tex");
  const resultsTex = await readTex("Results.tex");
  const discussionTex = await readTex("Discussion.tex");
  const procTex = await readTex("ExperimentalProcedures.tex");
  const suppTex = await readTex("SupplementaryMaterial.tex");

  const base = "papers/roboculture";

  // ── Paper root ──────────────────────────────
  await makePaper(
    base,
    {
      title: "RoboCulture: A Robotics Platform for Automated Biological Experimentation",
      slug: "roboculture",
      authors: [
        "Kevin Angers",
        "Kourosh Darvish",
        "Naruki Yoshikawa",
        "Sargol Okhovatian",
        "Dawn Bannerman",
        "Ilya Yakavets",
        "Florian Shkurti",
        "Alán Aspuru-Guzik",
        "Milica Radisic",
      ],
      journal: "Cell Systems / STAR Protocols",
      status: "submitted",
    },
    ["summary", "introduction", "results", "discussion", "experimental-procedures", "supplementary"],
    `# RoboCulture\n\nRoboCulture is a cost-effective, flexible robotics platform for automated biological experimentation. It uses a general-purpose robotic manipulator with vision and force feedback, behavior trees for experiment state management, and optical density-based growth monitoring to achieve fully autonomous cell culture.\n\n**arXiv:** 2505.14941v2\n`,
  );

  // ── Summary ─────────────────────────────────
  await makeSection(`${base}/summary`, "Summary", [], "Brief overview of RoboCulture capabilities.");
  await makeUnit(
    `${base}/summary/overview`,
    "Summarise the RoboCulture platform: what it does, why it matters, key technical contributions (liquid handling, force feedback tip exchange, OD growth monitoring, behavior trees, 15-hour yeast experiment).",
    [],
    `RoboCulture automates key biological tasks—liquid handling, pipette tip exchange, and optical density-based growth monitoring—using a general-purpose robotic manipulator. We demonstrate a fully autonomous 15-hour yeast culture experiment where RoboCulture uses vision and force feedback and a modular behavior tree framework to robustly execute, monitor, and manage experiments.`,
  );

  // ── Introduction ─────────────────────────────
  await makeSection(`${base}/introduction`, "Introduction", [
    "background",
    "problem-statement",
    "contributions",
  ]);
  const introDraft = latexToReadableDraft(introTex);
  const introChunks = introDraft.split(/(?=\*\*Contributions)/);

  await makeUnit(
    `${base}/introduction/background`,
    "Motivate lab automation: cell culture is tedious, SDLs offer flexibility, commercial liquid handlers are incomplete, industrial systems are costly and rigid. Establish the gap: no system combines flexibility + closed-loop feedback + long-horizon autonomy.",
    ["results/roboculture-design", "supplementary/related-work"],
    introChunks[0]?.trim() ?? "",
  );
  await makeUnit(
    `${base}/introduction/problem-statement`,
    "State the specific gap: existing manipulator-based systems need manual calibration, lack real-time perception, cannot handle biological stochasticity (cell growth variability). Frame the need for a reactive, modular framework.",
    [],
    "",
  );
  await makeUnit(
    `${base}/introduction/contributions`,
    "List the three RoboCulture contributions: (1) vision-based liquid handling with closed-loop control, (2) Digital Pipette v2 with interchangeable tips, (3) 15-hour autonomous yeast culture experiment with behavior tree orchestration.",
    ["results/yeast-experiment"],
    introChunks[1]?.trim() ?? "",
  );

  // ── Results ──────────────────────────────────
  await makeSection(`${base}/results`, "Results", [
    "roboculture-design",
    "pipetting-tasks",
    "visual-servoing",
    "optical-density",
    "behavior-tree",
    "yeast-experiment",
  ]);

  await makeUnit(
    `${base}/results/roboculture-design`,
    "Describe the integrated RoboCulture platform: Franka Emika arm + Robotiq gripper + Digital Pipette v2 + RealSense camera + shaker platform. Modular design rationale.",
    [],
    latexToReadableDraft(extractSubsection(resultsTex, "RoboCulture Design")).trim(),
  );
  await makeUnit(
    `${base}/results/pipetting-tasks`,
    "Detail the pipetting task evaluation: accuracy (ISO 8655 analogue), tip exchange success rate, comparison with manual pipetting by trained personnel. Key metric: <2% CV on volume delivery.",
    [],
    latexToReadableDraft(extractSubsection(resultsTex, "Pipetting Tasks")).trim(),
  );
  await makeUnit(
    `${base}/results/visual-servoing`,
    "Explain the image-based visual servoing controller for well plate navigation: how it corrects for calibration errors and positional offsets in real time to ensure reliable pipette insertion into 9mm-diameter wells.",
    ["experimental-procedures/visual-servoing-methods"],
    latexToReadableDraft(extractSubsection(resultsTex, "Visual Servoing")).trim(),
  );
  await makeUnit(
    `${base}/results/optical-density`,
    "Describe OD perception from camera: how optical density is estimated without a plate reader, how growth curves are extracted, and how the system determines splitting time.",
    ["experimental-procedures/optical-density-perception"],
    latexToReadableDraft(extractSubsection(resultsTex, "Optical Density")).trim(),
  );
  await makeUnit(
    `${base}/results/behavior-tree`,
    "Describe the behavior tree framework: modular behaviors (growth monitoring, sub-culturing, tip exchange), reactive state handling, how the BT coordinates vision / force / pipetting subsystems.",
    ["experimental-procedures/behavior-tree-methods", "supplementary/behavior-trees"],
    latexToReadableDraft(extractSubsection(resultsTex, "Behavior Tree")).trim(),
  );
  await makeUnit(
    `${base}/results/yeast-experiment`,
    "Present the 15-hour autonomous yeast experiment: setup, growth tracking across three replicates, correct splitting decision timing, post-split growth confirmation. Quantitative results on growth rate consistency.",
    ["results/optical-density", "results/behavior-tree"],
    latexToReadableDraft(extractSubsection(resultsTex, "Autonomous Yeast")).trim(),
  );

  // ── Discussion ───────────────────────────────
  await makeSection(`${base}/discussion`, "Discussion", ["main", "limitations"]);
  const discussionFull = latexToReadableDraft(discussionTex);
  const limStart = discussionFull.indexOf("### Limitations");
  await makeUnit(
    `${base}/discussion/main`,
    "Interpret results: visual servoing enables calibration-free well navigation; 15-hour autonomous culture validates the platform; compare with related manipulator systems. Highlight what makes RoboCulture uniquely suited for research settings.",
    ["results/yeast-experiment", "supplementary/related-work"],
    limStart > 0 ? discussionFull.slice(0, limStart).trim() : discussionFull,
  );
  await makeUnit(
    `${base}/discussion/limitations`,
    "Acknowledge limitations: visual servoing requires accurate perception (errors cause unintended motion); manual seeding step; current system validated on yeast only; tip exchange reliability in extreme conditions.",
    [],
    limStart > 0 ? discussionFull.slice(limStart).trim() : "",
  );

  // ── Experimental Procedures ──────────────────
  await makeSection(`${base}/experimental-procedures`, "Experimental Procedures", [
    "resource-availability",
    "digital-pipette-v2",
    "visual-servoing-methods",
    "optical-density-perception",
    "behavior-tree-methods",
    "yeast-experiment-methods",
  ]);

  const methodsMap = [
    ["resource-availability", "Resource Availability", "Provide links to code repo, CAD models, and key data. List lead contact and materials availability."],
    ["digital-pipette-v2", "Digital Pipette v2", "Describe the Digital Pipette v2 hardware: design changes from v1, tip interchangeability mechanism, force-feedback tip exchange, compatibility with Robotiq 2F-85 gripper."],
    ["visual-servoing-methods", "Visual Servoing for Liquid Handling", "Detail the visual servoing controller: camera setup, feature detection pipeline (Canny + FastSAM), control law, error correction loop, experimental validation protocol."],
    ["optical-density-perception", "Optical Density Perception for Growth Monitoring", "Describe the OD estimation algorithm: RGB image capture, Beer-Lambert approximation, calibration procedure, noise handling."],
    ["behavior-tree-methods", "Behavior Tree and Experiment State Handling", "Define the behavior tree nodes and conditions used, how failure handling works, how the BT integrates with ROS."],
    ["yeast-experiment-methods", "Yeast Experiment", "Full protocol: yeast strain, media, seeding density, shaker settings, image capture interval, splitting criteria, safety checks."],
  ];
  for (const [slug, heading, idea] of methodsMap) {
    await makeUnit(
      `${base}/experimental-procedures/${slug}`,
      idea,
      [],
      latexToReadableDraft(extractSubsection(procTex, heading.split(" ")[0])).trim(),
    );
  }

  // ── Supplementary ────────────────────────────
  await makeSection(`${base}/supplementary`, "Supplementary Information", [
    "related-work",
    "behavior-trees",
    "cad-models",
    "calibration",
  ]);

  await makeUnit(
    `${base}/supplementary/related-work`,
    "Survey related work: gantry-based liquid handlers (OT-2, Hamilton), industrial systems (StemCellFactory), manipulator-based approaches (IRAS, cellcultureautomation_ais). Position RoboCulture relative to each.",
    ["introduction/background"],
    latexToReadableDraft(extractSubsection(suppTex, "Related Work")).trim(),
  );
  await makeUnit(
    `${base}/supplementary/behavior-trees`,
    "Extended BT description: full tree structure figures, individual behavior definitions, pseudocode for growth-monitoring and sub-culturing sub-trees.",
    ["results/behavior-tree"],
    latexToReadableDraft(extractSubsection(suppTex, "Behavior Trees")).trim(),
  );
  await makeUnit(
    `${base}/supplementary/cad-models`,
    "Describe released CAD models: Digital Pipette v2 assembly, tip rack, tip remover mount. Provide assembly notes.",
    [],
    latexToReadableDraft(extractSubsection(suppTex, "CAD Models")).trim(),
  );
  await makeUnit(
    `${base}/supplementary/calibration`,
    "Hand-eye calibration error analysis: how position estimation error scales with calibration error, plots of final well plate positions, pipette calibration plots.",
    [],
    latexToReadableDraft(extractSubsection(suppTex, "Calibration")).trim(),
  );

  // ── Notes ─────────────────────────────────────
  const noteDirs = [
    `${base}/notes`,
    `${base}/notes/literature`,
    `${base}/notes/data`,
    `${base}/notes/feedback`,
    `${base}/notes/sessions`,
  ];
  for (const d of noteDirs) {
    const abs = path.join(modelRoot, d);
    if (!existsSync(abs)) await mkdir(abs, { recursive: true });
  }

  // Key literature notes from bib
  const litNotes = [
    {
      slug: "tom2024self",
      title: "Self-Driving Laboratories for Chemistry and Materials Science",
      authors: "Tom et al.",
      year: 2024,
      journal: "Chemical Reviews",
      doi: "10.1021/acs.chemrev.4c00055",
      relevance: ["introduction/background", "discussion/main"],
      summary: "Comprehensive review of SDL principles, hardware, AI methods, and applications across chemistry and materials science. Key reference for SDL positioning in introduction.",
    },
    {
      slug: "digital-pipette",
      title: "Digital pipette: open hardware for liquid transfer in self-driving laboratories",
      authors: "Yoshikawa et al.",
      year: 2023,
      journal: "Digital Discovery",
      doi: "10.1039/D3DD00115F",
      relevance: ["experimental-procedures/digital-pipette-v2", "results/pipetting-tasks"],
      summary: "Original Digital Pipette v1 paper. RoboCulture v2 is a direct successor. ISO 8655 validation methodology used as benchmark.",
    },
    {
      slug: "colledanchisebtrees",
      title: "Behavior Trees in Robotics and AI",
      authors: "Colledanchise & Ögren",
      year: 2018,
      journal: "CRC Press",
      doi: "",
      relevance: ["results/behavior-tree", "experimental-procedures/behavior-tree-methods"],
      summary: "Foundational textbook on behavior trees. Defines node types (Sequence, Fallback, Condition, Action) used throughout RoboCulture BT design.",
    },
  ];

  for (const note of litNotes) {
    const { slug, title, authors, year, journal, doi, relevance, summary } = note;
    const body = fm(
      { kind: "note", type: "literature", title, authors, year, journal, doi, cite_key: slug, relevance },
      `# ${title}\n\n**Authors:** ${authors} (${year})\n**Journal:** ${journal}\n\n## Summary\n\n${summary}\n`,
    );
    await writeFile(path.join(modelRoot, `${base}/notes/literature/${slug}.md`), body, "utf8");
    console.log("   note:", slug);
  }

  // Update paper root child_order is already in section_order above
  // Patch paper INDEX child_order for notes directory
  console.log("\nDone. Paper scaffold at:", path.join(modelRoot, base));
  console.log("\nSections created:");
  console.log("  summary/ → 1 unit");
  console.log("  introduction/ → 3 units (background, problem-statement, contributions)");
  console.log("  results/ → 6 units");
  console.log("  discussion/ → 2 units (main, limitations)");
  console.log("  experimental-procedures/ → 6 units");
  console.log("  supplementary/ → 4 units");
  console.log("  notes/literature/ → 3 notes");
  console.log("\nNext: open TreeWriter, navigate to papers/roboculture, use AI dispatch to revise sections.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
