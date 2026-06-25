import type { UnitStatusCounts } from "@/modelApi";
import type { CommentSummary } from "@treewriter/shared";
import { usePaperDetail } from "@/lib/usePaperDetail";

function CountsLine({ counts }: { counts: UnitStatusCounts }) {
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {counts.approved}a · {counts.drafted}d · {counts.outline}o
    </span>
  );
}

export function PaperInfoLine({
  slug,
  refreshVersion,
  onError,
  className,
  commentSummary,
}: {
  slug: string | null;
  refreshVersion: number;
  onError?: (message: string) => void;
  className?: string;
  commentSummary?: CommentSummary | null;
}) {
  const { detail, loading } = usePaperDetail(slug, refreshVersion, onError);

  if (!slug) return null;
  if (loading && !detail) {
    return (
      <p className={className ?? "text-[11px] leading-snug text-muted-foreground"}>
        Loading paper info…
      </p>
    );
  }
  if (!detail) return null;

  return (
    <p className={className ?? "text-[11px] leading-snug text-muted-foreground"}>
      {detail.journal ? `${detail.journal} · ` : null}
      {detail.status}
      {" · "}
      <CountsLine counts={detail.counts} />
      {commentSummary && commentSummary.assignedUnresolved > 0 ? (
        <>
          {" · "}
          <span className="text-primary">{commentSummary.assignedUnresolved} assigned open</span>
        </>
      ) : null}
    </p>
  );
}
