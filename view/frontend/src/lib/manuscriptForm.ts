import type { DocumentType, ManuscriptTemplate } from "@treewriter/shared";

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  paper: "Paper",
  grant: "Grant",
  report: "Report",
};

export function parseSectionOrder(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function applyTemplateSettings(template: ManuscriptTemplate) {
  return {
    targetWords: String(template.targetWords),
    sectionOrderText: template.sectionOrder.join("\n"),
    statusOptions: template.statusOptions,
  };
}

export function structurePreviewFolders(template: ManuscriptTemplate): string[] {
  return [
    ...template.sectionOrder.map((s) => `${s}/`),
    ...template.assetDirs.map((d) => `${d}/`),
    ...template.notesDirs.map((n) => `notes/${n}/`),
  ];
}

export function validateManuscriptCreate(input: {
  title: string;
  targetWords: string;
  sectionOrderText: string;
  docType: DocumentType;
  funder?: string;
  audience?: string;
  template?: ManuscriptTemplate;
}): string | null {
  if (!input.title.trim()) return "Title is required";
  const parsedTargetWords = Number(input.targetWords);
  if (!Number.isFinite(parsedTargetWords) || parsedTargetWords <= 0) {
    return "Target words must be a positive number";
  }
  if (parseSectionOrder(input.sectionOrderText).length === 0) {
    return "Add at least one section";
  }
  if (input.docType === "grant" && !input.funder?.trim()) {
    return "Funder is required for grants";
  }
  if (input.docType === "report" && input.template?.requiredFields.includes("audience")) {
    if (!input.audience?.trim()) return "Audience is required for this report template";
  }
  return null;
}

export function buildCreateManuscriptPayload(input: {
  title: string;
  docType: DocumentType;
  templateId: string;
  journal?: string;
  authors: string;
  slug: string;
  targetWords: string;
  sectionOrderText: string;
  status: string;
  overleafRepoPath: string;
  funder: string;
  program: string;
  deadline: string;
  audience: string;
  tags: string;
  project: string;
  contributionMode: "" | "kernel" | "repository";
  agentSummary: string;
}) {
  const authorList = input.authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const tagList = input.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    title: input.title.trim(),
    docType: input.docType,
    templateId: input.templateId,
    journal: input.docType === "paper" ? input.journal?.trim() : undefined,
    authors: authorList,
    slug: input.slug.trim() || undefined,
    targetWords: Number(input.targetWords),
    sectionOrder: parseSectionOrder(input.sectionOrderText),
    status: input.status,
    overleafRepoPath: input.docType === "paper" ? input.overleafRepoPath.trim() || null : null,
    funder: input.docType === "grant" ? input.funder.trim() : undefined,
    program: input.program.trim() || undefined,
    deadline: input.deadline.trim() || undefined,
    audience: input.docType === "report" ? input.audience.trim() : undefined,
    tags: tagList.length > 0 ? tagList : undefined,
    project: input.project.trim() || null,
    contributionMode:
      input.contributionMode === "kernel" || input.contributionMode === "repository"
        ? input.contributionMode
        : undefined,
    agentSummary: input.agentSummary.trim() || undefined,
  };
}
