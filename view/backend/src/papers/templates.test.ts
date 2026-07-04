import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listManuscriptTemplates, loadTemplate } from "./templates.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(tmpdir(), "tw-templates-"));
  await mkdir(path.join(modelRoot, "templates"), { recursive: true });
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("manuscript templates", () => {
  it("parses extended frontmatter including doc_type and notes_dirs", async () => {
    await writeFile(
      path.join(modelRoot, "templates/nsf-research-proposal.md"),
      `---
doc_type: grant
template_id: nsf-research-proposal
label: NSF Research Proposal
section_order:
  - specific-aims
notes_dirs:
  - literature
  - budget
asset_dirs: []
required_fields:
  - funder
export:
  primary_format: docx
---
`,
      "utf8",
    );

    const template = await loadTemplate(modelRoot, "nsf-research-proposal");
    expect(template.docType).toBe("grant");
    expect(template.templateId).toBe("nsf-research-proposal");
    expect(template.notesDirs).toEqual(["literature", "budget"]);
    expect(template.assetDirs).toEqual([]);
    expect(template.exportPrimaryFormat).toBe("docx");
    expect(template.requiredFields).toContain("funder");
  });

  it("defaults legacy journal templates to doc_type paper", async () => {
    await writeFile(
      path.join(modelRoot, "templates/plos-one.md"),
      `---
journal: PLOS ONE
section_order:
  - introduction
---
`,
      "utf8",
    );

    const template = await loadTemplate(modelRoot, "plos-one");
    expect(template.docType).toBe("paper");
    expect(template.assetDirs).toEqual(["figures", "tables", "equations"]);
    expect(template.notesDirs).toEqual(["literature", "data", "feedback"]);
  });

  it("filters listManuscriptTemplates by docType", async () => {
    await writeFile(
      path.join(modelRoot, "templates/plos-one.md"),
      "---\nsection_order:\n  - intro\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "templates/nsf-research-proposal.md"),
      "---\ndoc_type: grant\nsection_order:\n  - aims\n---\n",
      "utf8",
    );

    const grants = await listManuscriptTemplates(modelRoot, { docType: "grant" });
    expect(grants).toHaveLength(1);
    expect(grants[0]?.docType).toBe("grant");
  });
});
