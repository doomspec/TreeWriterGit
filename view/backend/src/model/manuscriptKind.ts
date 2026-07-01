import type { ContributionMode, DocumentType } from "@treewriter/shared";

const MANUSCRIPT_ROOT_KINDS = new Set(["paper", "manuscript"]);

export function isManuscriptRoot(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  return MANUSCRIPT_ROOT_KINDS.has(String(data.kind ?? ""));
}

export function docTypeFromIndex(data: Record<string, unknown> | null | undefined): DocumentType {
  const raw = String(data?.doc_type ?? "paper");
  if (raw === "grant" || raw === "report") return raw;
  return "paper";
}

export function contributionModeFromIndex(
  data: Record<string, unknown> | null | undefined,
): ContributionMode | null {
  const raw = data?.contribution_mode;
  if (raw === "kernel" || raw === "repository") return raw;
  return null;
}

export function buildManuscriptManifestBlock(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const docType = docTypeFromIndex(data);
  lines.push(`doc_type: ${docType}`);
  if (data.template_id) lines.push(`template_id: ${String(data.template_id)}`);
  if (data.project) lines.push(`project: ${String(data.project)}`);
  if (Array.isArray(data.tags) && data.tags.length > 0) {
    lines.push(`tags: ${(data.tags as string[]).join(", ")}`);
  }
  const mode = contributionModeFromIndex(data);
  if (mode) lines.push(`contribution_mode: ${mode}`);
  if (data.funder) lines.push(`funder: ${String(data.funder)}`);
  if (data.deadline) lines.push(`deadline: ${String(data.deadline)}`);
  if (data.agent_summary) {
    const summary = String(data.agent_summary).trim();
    if (summary) lines.push(`agent_summary: ${summary.slice(0, 500)}`);
  }
  return lines.join("\n");
}
