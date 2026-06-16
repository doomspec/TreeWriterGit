import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { outlinePathFor, type NavigateTarget } from "@/lib/modelTree";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SectionCompose = {
  path: string;
  title: string;
  kind: string | null;
  outlineMarkdown: string;
  draftMarkdown: string;
  children: Array<{
    name: string;
    path: string;
    title: string;
    summary: string | null;
    kind: "unit" | "section";
  }>;
};

export function SectionWorkspace({
  sectionPath,
  refreshVersion,
  onNavigate,
  onOpenFile,
  onError,
}: {
  sectionPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onError: (message: string) => void;
}) {
  const [compose, setCompose] = useState<SectionCompose | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiBaseUrl}/api/model/section-compose?path=${encodeURIComponent(sectionPath)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load section view (${res.status})`);
        return (await res.json()) as SectionCompose;
      })
      .then((data) => {
        if (!cancelled) {
          setCompose(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCompose(null);
          setLoading(false);
          onError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onError, refreshVersion, sectionPath]);

  const handleLinkNavigate = useCallback(
    (target: NavigateTarget) => {
      if (target.type === "file") {
        onOpenFile(target.path);
        return;
      }
      onNavigate(target.path);
    },
    [onNavigate, onOpenFile],
  );

  const outlinePath = outlinePathFor(sectionPath);
  const draftPath = `${sectionPath}/draft.md`;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Composing section view…
      </div>
    );
  }

  if (!compose) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Could not load section view.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <span className="text-xs font-medium text-muted-foreground">
          Section · {compose.title}
          {compose.kind ? ` (${compose.kind})` : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onOpenFile(outlinePath)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit outline
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onOpenFile(draftPath)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit draft
          </Button>
        </div>
      </div>

      <div className="unit-dual-pane grid min-h-0 flex-1">
        <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex h-9 shrink-0 items-center border-b border-border/60 bg-[hsl(var(--reading-bg))] px-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Outline
            </span>
          </div>
          <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
            <MarkdownViewer
              markdown={compose.outlineMarkdown}
              linkContextPath={sectionPath}
              linksClickable
              onNavigate={handleLinkNavigate}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-9 shrink-0 items-center border-b border-border/60 bg-[hsl(var(--reading-bg))] px-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Draft
            </span>
          </div>
          <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
            {compose.draftMarkdown.trim() ? (
              <MarkdownViewer
                markdown={compose.draftMarkdown.replace(/^#\s+.+\n+/, "")}
                linkContextPath={sectionPath}
                linksClickable
                onNavigate={handleLinkNavigate}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No draft content yet — open subsections to write.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
