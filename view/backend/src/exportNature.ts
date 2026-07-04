import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";

import type { JournalExportStyle } from "./journalExportStyle.js";
import type { AuthorEntry } from "@treewriter/shared";
import { authorFullName, authorInitials } from "@treewriter/shared";

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

/** LaTeX-escape author/affiliation free text (title uses its own escaper). */
function escapeLatexInline(text: string): string {
  return text.replace(/([#%&_{}])/g, "\\$1");
}

const AFFILIATION_TBD = "Affiliation TBD — edit main.tex or add author metadata to the paper INDEX.";

/** Superscript marks for one author: affiliation numbers, then † (equal) and * (corresponding). */
function authorMarks(author: AuthorEntry): string {
  const marks: string[] = author.affiliations.map(String);
  if (author.equalContribution) marks.push("\\dagger");
  if (author.corresponding) marks.push("*");
  return marks.length > 0 ? `$^{${marks.join(",")}}$` : "";
}

/**
 * Build the `\author{...}` body and the `\begin{affiliations}` items from
 * structured authors. Each author gets superscript affiliation numbers plus
 * †/* markers. Falls back to a legacy single `author` string / TBD placeholders
 * so older papers still export.
 */
export function buildAuthorBlock(input: {
  authors?: AuthorEntry[];
  affiliations?: string[];
  legacyAuthor?: string;
}): { authorLine: string; affiliationItems: string[] } {
  const authors = input.authors ?? [];
  const affiliations = (input.affiliations ?? []).map((a) => a.trim()).filter(Boolean);
  const affiliationItems = affiliations.length > 0 ? affiliations.map(escapeLatexInline) : [AFFILIATION_TBD];

  if (authors.length === 0) {
    return { authorLine: input.legacyAuthor?.trim() || "Author names TBD", affiliationItems };
  }

  const authorLine = authors
    .map((author) => `${escapeLatexInline(authorFullName(author))}${authorMarks(author)}`)
    .join(", ");
  return { authorLine, affiliationItems };
}

/** Addendum `\item[...]` note lines: equal-contribution, correspondence (name + email), ORCID. */
export function buildAuthorNotes(authors: AuthorEntry[]): string[] {
  const notes: string[] = [];
  if (authors.some((a) => a.equalContribution)) {
    notes.push("\\item[$\\dagger$] These authors contributed equally.");
  }
  for (const a of authors.filter((a) => a.corresponding)) {
    const name = escapeLatexInline(authorFullName(a));
    const email = a.email ? ` (${escapeLatexInline(a.email)})` : "";
    notes.push(`\\item[$*$] Correspondence: ${name}${email}.`);
  }
  for (const a of authors.filter((a) => a.orcid)) {
    notes.push(`\\item[ORCID] ${escapeLatexInline(authorFullName(a))} — ${escapeLatexInline(a.orcid ?? "")}`);
  }
  return notes;
}

/** CRediT "Author contributions" section, or "" when no author has roles. */
export function buildCreditStatement(authors: AuthorEntry[]): string {
  const withRoles = authors.filter((a) => a.credit && a.credit.length > 0);
  if (withRoles.length === 0) return "";
  const sentences = withRoles.map(
    (a) => `${escapeLatexInline(authorInitials(a))}: ${(a.credit ?? []).map(escapeLatexInline).join(", ")}.`,
  );
  return ["\\section*{Author contributions}", sentences.join(" ")].join("\n");
}

/** Build main.tex following sedimentorc/nature-template structure. */
export function buildNatureMainTexDocument(input: {
  title: string;
  /** @deprecated legacy single-string author; prefer `authors`. */
  author?: string;
  authors?: AuthorEntry[];
  affiliations?: string[];
  abstractSection?: string;
  bodySections: string[];
  methodsSection?: string;
  supplementarySection?: string;
  bibBaseName?: string;
}): string {
  const { authorLine, affiliationItems } = buildAuthorBlock({
    authors: input.authors,
    affiliations: input.affiliations,
    legacyAuthor: input.author,
  });
  const authorNotes = buildAuthorNotes(input.authors ?? []);
  const creditStatement = buildCreditStatement(input.authors ?? []);
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
    `\\author{${authorLine}}`,
    "",
    "\\begin{document}",
    "",
    "\\maketitle",
    "",
    "\\begin{affiliations}",
    ...affiliationItems.map((item) => `\\item ${item}`),
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

  if (creditStatement) {
    lines.push(creditStatement, "");
  }

  lines.push(
    "\\noindent{\\bfseries References}\\setlength{\\parskip}{12pt}%",
    "",
    `\\bibliography{${bibBase}}`,
    "",
    "\\begin{addendum}",
    "\\item [Acknowledgments] Add acknowledgments in the paper INDEX or a dedicated section.",
    "\\item[Competing Interests] The authors declare no competing interests.",
    ...(authorNotes.length > 0
      ? authorNotes
      : ["\\item[Correspondence] Correspondence should be addressed to the corresponding author."]),
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
