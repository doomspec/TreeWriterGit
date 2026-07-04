#!/usr/bin/env node
/**
 * Scaffold papers/treewriter-guide/ — onboarding paper from model/TreeWriter/new-paper-guide.md
 * Run: node scripts/scaffold-treewriter-guide.mjs
 */

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const modelRoot = path.join(repoRoot, "model");
const base = "papers/treewriter-guide";

function fm(data, body = "") {
  const lines = ["---"];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else if (typeof v === "number") {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + (body ? body.trimStart() + "\n" : "");
}

function titleCase(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function writeApprovalSnapshot(abs, kind, content, approvedBy = "treewriter-guide-scaffold") {
  const approvalDir = path.join(abs, ".approval");
  await mkdir(approvalDir, { recursive: true });
  const body = content.endsWith("\n") ? content : `${content}\n`;
  await writeFile(path.join(approvalDir, `${kind}.approved.md`), body, "utf8");
  const now = new Date().toISOString();
  await writeFile(
    path.join(approvalDir, `${kind}.yaml`),
    [
      "content_hash: null",
      "git_commit: null",
      "git_file_blob: null",
      `approved_at: ${JSON.stringify(now)}`,
      `approved_by: ${JSON.stringify(approvedBy)}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function makeApprovedUnit(relPath, { title, idea, draft, links = [] }) {
  const abs = path.join(modelRoot, relPath);
  await mkdir(abs, { recursive: true });
  const now = new Date().toISOString();
  await writeFile(
    path.join(abs, "INDEX.md"),
    fm(
      {
        kind: "unit",
        title,
        status: "approved",
        links,
        approved_at: now,
        approved_by: "treewriter-guide-scaffold",
      },
      "",
    ),
    "utf8",
  );
  const outline = `# ${title}\n\n## Summary\n\n${idea}\n`;
  await writeFile(path.join(abs, "outline.md"), outline, "utf8");
  await writeApprovalSnapshot(abs, "outline", outline);
  const body = draft.endsWith("\n") ? draft : `${draft}\n`;
  await writeFile(path.join(abs, "draft.md"), body, "utf8");
  await writeApprovalSnapshot(abs, "draft", body);
  console.log("  unit:", relPath);
}

async function makeSection(relPath, title, childOrder, summary) {
  const abs = path.join(modelRoot, relPath);
  await mkdir(abs, { recursive: true });
  const childLinks = childOrder.map((c) => `* [${titleCase(c)}](${c}/INDEX.md)`).join("\n");
  const outline =
    `# ${title}\n\n## Summary\n\n${summary}\n\n## Outline\n\n${childLinks ? `${childLinks}\n` : ""}`;
  await writeFile(
    path.join(abs, "INDEX.md"),
    fm({ kind: "section", title, child_order: childOrder }, ""),
    "utf8",
  );
  await writeFile(path.join(abs, "outline.md"), outline, "utf8");
  console.log("section:", relPath);
}

async function makeAssetContainer(relPath, title) {
  const abs = path.join(modelRoot, relPath);
  await mkdir(abs, { recursive: true });
  await writeFile(
    path.join(abs, "INDEX.md"),
    fm({ kind: "section", title, child_order: [] }, ""),
    "utf8",
  );
  await writeFile(
    path.join(abs, "outline.md"),
    `# ${title}\n\n## Summary\n\nAsset folders for this paper.\n`,
    "utf8",
  );
}

async function makeFigure(relPath, { title, caption, mermaidSource }) {
  const abs = path.join(modelRoot, relPath);
  await mkdir(abs, { recursive: true });
  const preview = "source.mmd";
  await writeFile(
    path.join(abs, "INDEX.md"),
    fm(
      {
        kind: "figure",
        title,
        status: "approved",
        figure_source: preview,
        figure_preview: preview,
        links: [],
        approved_at: new Date().toISOString(),
      },
      "",
    ),
    "utf8",
  );
  await writeFile(
    path.join(abs, "outline.md"),
    `# ${title}\n\n## Summary\n\nWorkflow diagram for the TreeWriter guide.\n`,
    "utf8",
  );
  const cap = caption.endsWith("\n") ? caption : `${caption}\n`;
  await writeFile(path.join(abs, "draft.md"), cap, "utf8");
  await writeApprovalSnapshot(abs, "draft", cap);
  await writeFile(path.join(abs, "source.mmd"), mermaidSource, "utf8");
  console.log(" figure:", relPath);
}

async function main() {
  const paperAbs = path.join(modelRoot, base);
  if (existsSync(path.join(paperAbs, "INDEX.md"))) {
    console.error(`Already exists: ${base}. Remove it first or edit in place.`);
    process.exit(1);
  }

  const sectionOrder = [
    "quick-start",
    "structure",
    "working-with-figures",
    "export-and-overleaf",
    "reference",
  ];

  await mkdir(paperAbs, { recursive: true });
  await writeFile(
    path.join(paperAbs, "INDEX.md"),
    fm(
      {
        kind: "paper",
        title: "TreeWriter Guide",
        slug: "treewriter-guide",
        journal: "TreeWriter",
        status: "Published",
        authors: ["TreeWriter"],
        target_words: 8000,
        section_order: sectionOrder,
        overleaf_repo_path: null,
        last_export: null,
      },
      `# TreeWriter Guide\n\nHands-on documentation for writing papers in TreeWriter: structure, figures, approval, and export. You are reading this paper inside the app — explore sections in the Papers sidebar.\n`,
    ),
    "utf8",
  );
  await writeFile(
    path.join(paperAbs, "outline.md"),
    `# TreeWriter Guide\n\n## Summary\n\nOnboarding documentation shipped as a real paper so you can see structure, units, figures, and export in action.\n\n## Outline\n\n${sectionOrder.map((s) => `* [${titleCase(s)}](${s}/INDEX.md)`).join("\n")}\n`,
    "utf8",
  );

  for (const dir of ["figures", "tables", "equations"]) {
    await makeAssetContainer(`${base}/${dir}`, titleCase(dir));
  }
  for (const notesDir of ["literature", "data", "feedback"]) {
    const notesRel = `${base}/notes/${notesDir}`;
    await mkdir(path.join(modelRoot, notesRel), { recursive: true });
    await writeFile(
      path.join(modelRoot, notesRel, "INDEX.md"),
      fm({ kind: "note", title: titleCase(notesDir) }, `# ${titleCase(notesDir)}\n\n`),
      "utf8",
    );
  }

  // ── quick-start ──
  await makeSection(
    `${base}/quick-start`,
    "Quick Start",
    ["what-is-treewriter", "create-a-paper"],
    "What TreeWriter is and how to create your first manuscript paper.",
  );
  await makeApprovedUnit(`${base}/quick-start/what-is-treewriter`, {
    title: "What TreeWriter is",
    idea: "Explain the recursive folder tree, Git source of truth, and three-file pattern.",
    draft: `TreeWriter treats a paper as a **recursive folder tree** stored in Git under \`model/papers/{paper-slug}/\`. You edit in the web UI; export assembles approved unit drafts into LaTeX/PDF (and optionally pushes to Overleaf).

Each node uses up to three coordinated files: **INDEX.md** (metadata and ordering), **outline.md** (what to say), and **draft.md** (exportable manuscript text on unit leaves).

::figure[${base}/figures/fig-workflow]`,
  });
  await makeApprovedUnit(`${base}/quick-start/create-a-paper`, {
    title: "Create a new paper",
    idea: "UI steps for New paper and what the journal template scaffolds.",
    draft: `Open the **Papers** panel (stack icon in the left sidebar), click **New paper**, enter a title, and pick a journal template (e.g. PLOS ONE). TreeWriter scaffolds \`model/papers/{slug}/\` with top-level sections from the template.

Each **section** is a container folder with \`outline.md\` and child units. **Ordering** comes from \`section_order\` and \`child_order\` in INDEX frontmatter — drag rows in the Papers sidebar to reorder, not folder names on disk.`,
  });

  // ── structure ──
  await makeSection(
    `${base}/structure`,
    "Structure",
    [
      "containers-vs-units",
      "outline-draft-approve",
      "building-structure",
      "citations",
      "section-vs-unit-view",
      "ai-dispatch",
    ],
    "How the paper tree works: containers, units, approval, and navigation.",
  );
  await makeApprovedUnit(`${base}/structure/containers-vs-units`, {
    title: "Containers vs units",
    idea: "Table of node roles and which files each type uses.",
    draft: `**Containers** (paper, section, subsection) hold \`INDEX.md\` and \`outline.md\` only — they group children. **Units** (paragraph leaves) add \`draft.md\` for manuscript text. **Figures, tables, and equations** are special units under \`figures/\`, \`tables/\`, and \`equations/\` with captions in \`draft.md\` and asset files alongside.`,
  });
  await makeApprovedUnit(`${base}/structure/outline-draft-approve`, {
    title: "Outline, draft, and approve",
    idea: "Status workflow and step-by-step for one paragraph.",
    draft: `Unit status flows **outline → drafted → approved**. Only **approved** units export by default.

For each paragraph: create a unit under a section, write the **outline** brief, write the **draft** prose (use \`[@cite_key]\` for citations), then click **Approve**. Amber rows in the Papers tree mean unapproved text somewhere beneath. Use **Approve all in children** in section view for bulk approval.`,
  });
  await makeApprovedUnit(`${base}/structure/building-structure`, {
    title: "Building structure",
    idea: "New section, subsection, unit, reorder, cross-links.",
    draft: `Create **sections** from the paper row, **subsections** and **units** from section rows, or use the command palette (\`⌘K\` → “New unit”). Reorder by dragging the grip handle on any row.

Optional **cross-links** in unit \`INDEX.md\` \`links:\` connect narrative nodes (e.g. problem ↔ discussion). Open the **Graph** sidebar panel to visualize edges — these are not citations.`,
  });
  await makeApprovedUnit(`${base}/structure/citations`, {
    title: "Citations and literature",
    idea: "BibTeX import and Pandoc cite syntax.",
    draft: `Import BibTeX from **Assets → References → Upload .bib**. Each entry becomes \`notes/literature/{file}.md\` with a \`cite_key\`.

Cite in drafts with \`[@cite_key]\` or \`[@a2024; @b2020]\`. Do **not** use \`\\cite{}\` in \`draft.md\` — export uses Pandoc citation syntax.`,
  });
  await makeApprovedUnit(`${base}/structure/section-vs-unit-view`, {
    title: "Section view vs unit view",
    idea: "Composed draft vs single-paragraph editing.",
    draft: `**Section view** stitches approved child unit drafts into a composed preview — use it to read the whole section and run fan-out AI dispatch. **Unit view** focuses on one paragraph for tight editing.

Open the **Document outline** panel (\`⌘⇧O\`) to jump between headings and linked children.`,
  });
  await makeApprovedUnit(`${base}/structure/ai-dispatch`, {
    title: "AI dispatch",
    idea: "Optional AI workflow and tw-context CLI.",
    draft: `Open the **AI dispatch** panel (terminal area or bot icon). Choose draft/revise actions; review output in \`draft.md\`, then approve.

Enable skills under **Dispatch → Skills**. For extra context from the terminal (cwd usually \`model/\`):

\`\`\`bash
node ../scripts/tw-context.mjs search "keywords" --root papers/my-study
node ../scripts/tw-context.mjs read papers/my-study/unit/draft.md
\`\`\``,
  });

  // ── working-with-figures ──
  await makeSection(
    `${base}/working-with-figures`,
    "Working with Figures",
    [
      "figures-overview",
      "create-a-figure",
      "embed-figures",
      "mermaid-diagrams",
      "tables-and-equations",
    ],
    "Create figure units, upload art, and embed in unit drafts.",
  );
  await makeApprovedUnit(`${base}/working-with-figures/figures-overview`, {
    title: "Figure folder anatomy",
    idea: "INDEX, outline, draft, source files.",
    draft: `Figures live in \`papers/{slug}/figures/{name}/\`. Each figure unit has **INDEX.md** (\`kind: figure\`, \`figure_source\`), **outline.md** (panel plan), **draft.md** (caption for export), and image or \`.mmd\` source files.

Example caption in \`draft.md\`: **Fig 1.** Workflow overview. (A) … (B) …`,
  });
  await makeApprovedUnit(`${base}/working-with-figures/create-a-figure`, {
    title: "Create a figure in the UI",
    idea: "Assets panel flow.",
    draft: `In **Papers**, select your paper → **Assets → Figures** → **+**. Enter a slug (\`fig1\`). Write outline and caption draft, upload PNG/SVG/PDF or add a \`.mmd\` file, then **Approve** the caption when ready for export.`,
  });
  await makeApprovedUnit(`${base}/working-with-figures/embed-figures`, {
    title: "Embed figures in drafts",
    idea: "Block embed vs wikilink.",
    draft: `Use **block embeds** on their own line:

\`\`\`
::figure[papers/my-study/figures/fig1]
\`\`\`

Use **wikilinks** for in-text references:

\`\`\`
[[papers/my-study/figures/fig1|Figure 1]]
\`\`\`

Paths always start with \`papers/…\`. Typing \`\\fig{}\` in the editor opens autocomplete — never leave raw \`\\fig{}\` in saved text.`,
  });
  await makeApprovedUnit(`${base}/working-with-figures/mermaid-diagrams`, {
    title: "Mermaid diagram figures",
    idea: "source.mmd + rendered preview.",
    draft: `Keep editable **Mermaid source** (\`source.mmd\`) in the figure folder, render to PNG for LaTeX export as \`figure_source\`, and embed with \`::figure[…]\` as usual. The demo figure in this guide (\`figures/fig-workflow\`) is a Mermaid source example.`,
  });
  await makeApprovedUnit(`${base}/working-with-figures/tables-and-equations`, {
    title: "Tables and equations",
    idea: "Same asset pattern as figures.",
    draft: `| Asset | Block embed | In-text ref |
| --- | --- | --- |
| Table | \`[[papers/…/tables/name\\|Caption]]\` | \`[[papers/…/tables/name\\|Table 1]]\` |
| Equation | \`::equation[papers/…/equations/name]\` | \`[[papers/…/equations/name\\|Eq. (1)]]\` |

Create from **Assets → Tables / Equations** in the Papers sidebar.`,
  });

  // ── export ──
  await makeSection(
    `${base}/export-and-overleaf`,
    "Export and Overleaf",
    ["export-basics", "first-hour-checklist"],
    "Export approved text to LaTeX/PDF and push to Overleaf.",
  );
  await makeApprovedUnit(`${base}/export-and-overleaf/export-basics`, {
    title: "Export and Overleaf",
    idea: "Export panel, include-drafts toggle, auto-export.",
    draft: `When units and figure captions are **approved**, open **Export & Overleaf** (download icon). Download LaTeX/PDF or **Push to Overleaf** after connecting your Git URL.

Leave **Include non-approved drafts** off for collaborator pushes. Export walks \`section_order\` / \`child_order\`, expands embeds, and copies figure assets to \`.treewriter-exports/\`.

Enable **auto-export** under **Settings → Export** for debounced rebuilds after edits.`,
  });
  await makeApprovedUnit(`${base}/export-and-overleaf/first-hour-checklist`, {
    title: "First-hour checklist",
    idea: "Recommended first session steps.",
    draft: `1. Create a paper from a journal template.
2. List units in each section \`outline.md\` before long drafts.
3. Create figure units **before** referencing them in results text.
4. Draft one unit end-to-end (outline → draft → approve).
5. Export a PDF with only approved content to verify paths and citations.`,
  });

  // ── reference ──
  await makeSection(
    `${base}/reference`,
    "Reference",
    ["common-mistakes", "quick-reference"],
    "Troubleshooting and syntax cheat sheet.",
  );
  await makeApprovedUnit(`${base}/reference/common-mistakes`, {
    title: "Common mistakes",
    idea: "Troubleshooting table.",
    draft: `| Mistake | Fix |
| --- | --- |
| Prose in \`outline.md\` that should export | Move to unit \`draft.md\` |
| \`\\cite{}\` / \`\\fig{}\` left in drafts | Use \`[@key]\` and \`::figure[…]\` |
| Figure path missing \`papers/{slug}/\` prefix | Always use full path from \`papers/…\` |
| Export missing a paragraph | Unit must be \`approved\` (or enable include-drafts) |
| Wrong section order | Drag in sidebar; don't rename folders to sort |`,
  });
  await makeApprovedUnit(`${base}/reference/quick-reference`, {
    title: "Quick reference",
    idea: "Syntax and UI cheat sheet.",
    draft: `\`\`\`text
STRUCTURE
  Paper   → papers/{slug}/
  Section → …/introduction/     (container)
  Unit    → …/introduction/problem/  (leaf, has draft.md)
  Figure  → …/figures/fig1/

STATUS: outline → drafted → approved

MARKUP
  Cite:     [@cite_key]
  Figure:   ::figure[papers/slug/figures/name]
  Fig ref:  [[papers/slug/figures/name|Figure 1]]
  Equation: ::equation[papers/slug/equations/name]
  Table:    [[papers/slug/tables/name|Table caption]]

UI: Papers tree · Assets · Section/Unit view · ? guide · Export panel
\`\`\``,
  });

  const figRel = `${base}/figures/fig-workflow`;
  await makeFigure(figRel, {
    title: "Fig Workflow",
    caption:
      "**Fig 1.** TreeWriter data flow. The UI reads and writes Git markdown under `model/papers/`; export composes approved drafts into LaTeX and optionally pushes to Overleaf.",
    mermaidSource: `flowchart LR
  subgraph sources["Your workspace"]
    UI["TreeWriter UI"]
    Git["Git repo\\nmodel/papers/…"]
  end
  subgraph output["Collaboration"]
    Export["Export bundle\\n.tex + figures"]
    OL["Overleaf Git push"]
  end
  UI <-->|read/write| Git
  Git --> Export
  Export --> OL
`,
  });

  // Patch figures container child_order
  await writeFile(
    path.join(modelRoot, `${base}/figures/INDEX.md`),
    fm({ kind: "section", title: "Figures", child_order: ["fig-workflow"] }, ""),
    "utf8",
  );

  console.log("\nDone:", path.join(modelRoot, base));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
