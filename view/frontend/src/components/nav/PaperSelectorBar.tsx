import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PaperSelect, paperSlugFromPath } from "@/components/nav/PaperSelect";
import { NewPaperModal } from "@/components/paper/NewPaperModal";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { usePaperList } from "@/lib/usePaperList";
import type { ModelNode } from "@/lib/modelTree";
import { deletePaper } from "@/modelApi";

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
      <div className="flex items-center gap-1.5">
        <PaperSelect
          papers={papers}
          selectedSlug={selectedSlug}
          loading={loading}
          className="min-w-0 flex-1"
          onChange={handlePaperChange}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Edit paper"
          aria-label="Edit paper"
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
          title="Delete paper"
          aria-label="Delete paper"
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
          title="New paper"
          aria-label="New paper"
          onClick={() => setShowNewPaper(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {showNewPaper ? (
        <NewPaperModal
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
        <NewPaperModal
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
