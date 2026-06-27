import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";

import type { JournalExportStyle } from "./journalExportStyle.js";

const ABSTRACT_SLUGS = new Set(["abstract", "summary"]);
const METHODS_SLUGS = new Set(["methods", "experimental-procedures", "materials-and-methods"]);
const SUPPLEMENTARY_SLUGS = new Set([
  "supplementary-information",
  "supplementary",
  "supplement",
  "extended-data",
  "supporting-information",
]);

export function usesNatureLatexTemplate(style: JournalExportStyle | undefined): boolean {
  return style?.documentclass === "nature" && Boolean(style.templateBundle?.trim());
}

export function classifyNatureSectionSlugs(sectionSlugs: string[]): {
  abstract?: string;
  body: string[];
  methods?: string;
  supplementary?: string;
} {
  const body: string[] = [];
  let abstract: string | undefined;
  let methods: string | undefined;
  let supplementary: string | undefined;

  for (const slug of sectionSlugs) {
    const key = slug.toLowerCase();
    if (ABSTRACT_SLUGS.has(key)) {
      abstract = slug;
      continue;
    }
    if (METHODS_SLUGS.has(key)) {
      methods = slug;
      continue;
    }
    if (SUPPLEMENTARY_SLUGS.has(key) || key.includes("supplement")) {
      supplementary = slug;
      continue;
    }
    body.push(slug);
  }

  return { abstract, body, methods, supplementary };
}

function latexInput(relativePath: string): string {
  return `\\input{${relativePath.replace(/\\/g, "/")}}`;
}

/** Build main.tex following sedimentorc/nature-template structure. */
export function buildNatureMainTexDocument(input: {
  title: string;
  author?: string;
  abstractSection?: string;
  bodySections: string[];
  methodsSection?: string;
  supplementarySection?: string;
  bibBaseName?: string;
}): string {
  const author = input.author?.trim() || "Author names TBD";
  const bibBase = input.bibBaseName?.trim() || "references";
  const lines: string[] = [
    "% Nature preprint layout — sedimentorc/nature-template",
    "\\documentclass{nature}",
    "",
    "\\input{preamble.tex}",
    "",
    "\\bibliographystyle{naturemag}",
    "",
    `\\title{${escapeLatexTitle(input.title)}}`,
    "",
    `\\author{${author}}`,
    "",
    "\\begin{document}",
    "",
    "\\maketitle",
    "",
    "\\begin{affiliations}",
    "\\item Affiliation TBD — edit main.tex or add author metadata to the paper INDEX.",
    "\\end{affiliations}",
    "",
  ];

  if (input.abstractSection) {
    lines.push(latexInput(`sections/${input.abstractSection}`), "");
  }

  lines.push("\\beginbodyfigures", "");

  for (const slug of input.bodySections) {
    lines.push(latexInput(`sections/${slug}`), "");
  }

  if (input.methodsSection) {
    lines.push(latexInput(`sections/${input.methodsSection}`), "");
  }

  lines.push(
    "\\noindent{\\bfseries References}\\setlength{\\parskip}{12pt}%",
    "",
    `\\bibliography{${bibBase}}`,
    "",
    "\\begin{addendum}",
    "\\item [Acknowledgments] Add acknowledgments in the paper INDEX or a dedicated section.",
    "\\item[Competing Interests] The authors declare no competing interests.",
    "\\item[Correspondence] Correspondence should be addressed to the corresponding author.",
    "\\end{addendum}",
    "",
  );

  if (input.supplementarySection) {
    lines.push("\\beginedfigures", latexInput(`sections/${input.supplementarySection}`), "");
  }

  lines.push("\\end{document}", "");
  return lines.join("\n");
}

function escapeLatexTitle(title: string): string {
  return title.replace(/([#%&_{}])/g, "\\$1");
}

export async function copyJournalTemplateBundle(
  modelRoot: string,
  bundleRel: string,
  targetDir: string,
): Promise<string[]> {
  const normalized = bundleRel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) return [];

  const sourceDir = path.join(modelRoot, "templates", normalized);
  if (!existsSync(sourceDir)) return [];

  await mkdir(targetDir, { recursive: true });
  const copied: string[] = [];
  for (const file of await readdir(sourceDir)) {
    if (file.startsWith(".")) continue;
    const source = path.join(sourceDir, file);
    if (!existsSync(source)) continue;
    const dest = path.join(targetDir, file);
    await copyFile(source, dest);
    copied.push(file);
  }
  return copied;
}
