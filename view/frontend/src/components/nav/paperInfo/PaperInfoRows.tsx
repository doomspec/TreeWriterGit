import { DOC_TYPE_LABELS } from "@/lib/manuscriptForm";
import type { PaperDetail } from "@/modelApi";

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-2 text-[11px] leading-snug">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{value}</span>
    </div>
  );
}

export function PaperInfoContent({ detail }: { detail: PaperDetail }) {
  return (
    <>
      <p className="text-xs font-medium leading-snug text-foreground">{detail.title}</p>
      <div className="space-y-1.5">
        <InfoRow label="Type" value={DOC_TYPE_LABELS[detail.docType ?? "paper"]} />
        <InfoRow label="Journal" value={detail.journal} />
        <InfoRow label="Template" value={detail.templateLabel} />
        <InfoRow label="Status" value={detail.status} />
        <InfoRow
          label="Words"
          value={`${detail.draftWordCount.toLocaleString()} / ${detail.targetWords.toLocaleString()}`}
        />
        <InfoRow
          label="Units"
          value={
            <span className="font-mono text-[10px]">
              {detail.counts.approved}a · {detail.counts.drafted}d · {detail.counts.outline}o
            </span>
          }
        />
      </div>
    </>
  );
}

export function buildUpdatePayload(detail: PaperDetail, authors: PaperDetail["authorDetails"]) {
  return {
    slug: detail.slug,
    title: detail.title,
    authors,
    affiliations: detail.affiliations,
    journal: detail.journal ?? undefined,
    templateId: detail.templateId ?? undefined,
    targetWords: detail.targetWords,
    sectionOrder: detail.sectionOrder,
    status: detail.status,
    overleafRepoPath: detail.overleafRepoPath,
    funder: detail.funder,
    program: detail.program,
    deadline: detail.deadline,
    audience: detail.audience,
    tags: detail.tags ?? [],
    project: detail.project,
    contributionMode: detail.contributionMode,
    agentSummary: detail.agentSummary,
  };
}
