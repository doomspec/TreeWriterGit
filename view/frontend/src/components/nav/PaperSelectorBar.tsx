import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PaperSelect, paperSlugFromPath } from "@/components/nav/PaperSelect";
import { NewManuscriptModal } from "@/components/paper/NewManuscriptModal";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { usePaperList } from "@/lib/usePaperList";
import type { ModelNode } from "@/lib/modelTree";
import { deletePaper, type DocumentType } from "@/modelApi";

export function PaperSelectorBar({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged?: () => void;
  onError: (message: string) => void;
}) {
  const { papers, loading } = usePaperList(tree, refreshVersion, onError);
  const [showNewPaper, setShowNewPaper] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState<DocumentType | "all">("all");
  const selectedSlug = paperSlugFromPath(currentPath);
  const selectedPaper = papers.find((paper) => paper.slug === selectedSlug);

  const handlePaperChange = (slug: string) => {
    if (!slug) {
      onNavigate("papers");
      return;
    }
    onNavigate(`papers/${slug}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSlug) return;
    const slug = deleteSlug;
    setDeleteSlug(null);
    setDeleting(true);
    try {
      await deletePaper(slug);
      onModelChanged?.();
      const remaining = papers.filter((paper) => paper.slug !== slug);
      onNavigate(remaining[0] ? `papers/${remaining[0].slug}` : "papers");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {(["all", "paper", "grant", "report"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              docTypeFilter === filter ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => setDocTypeFilter(filter)}
          >
            {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <PaperSelect
          papers={papers}
          selectedSlug={selectedSlug}
          loading={loading}
          docTypeFilter={docTypeFilter}
          className="min-w-0 flex-1"
          onChange={handlePaperChange}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Edit manuscript"
          aria-label="Edit manuscript"
          disabled={!selectedSlug || deleting}
          onClick={() => selectedSlug && setEditSlug(selectedSlug)}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Delete manuscript"
          aria-label="Delete manuscript"
          disabled={!selectedSlug || deleting}
          onClick={() => selectedSlug && setDeleteSlug(selectedSlug)}
        >
          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="New manuscript"
          aria-label="New manuscript"
          onClick={() => setShowNewPaper(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {showNewPaper ? (
        <NewManuscriptModal
          onClose={() => setShowNewPaper(false)}
          onCreated={(path) => {
            setShowNewPaper(false);
            onModelChanged?.();
            onPaperCreated(path);
          }}
          onError={onError}
        />
      ) : null}

      {editSlug ? (
        <NewManuscriptModal
          editSlug={editSlug}
          onClose={() => setEditSlug(null)}
          onCreated={(path) => {
            setEditSlug(null);
            onModelChanged?.();
            onPaperCreated(path);
          }}
          onError={onError}
        />
      ) : null}

      <ConfirmDialog
        open={deleteSlug !== null}
        title="Delete paper?"
        message={
          selectedPaper
            ? `Permanently delete "${selectedPaper.title}" and all of its sections, notes, and assets? This cannot be undone.`
            : "Permanently delete this paper and all of its contents? This cannot be undone."
        }
        confirmLabel={deleting ? "Deleting…" : "Delete paper"}
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteSlug(null)}
      />
    </>
  );
}
