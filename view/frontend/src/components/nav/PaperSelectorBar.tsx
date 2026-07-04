import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DocTypeFilterChips } from "@/components/nav/DocTypeFilterChips";
import { PaperSelect, paperSlugFromPath } from "@/components/nav/PaperSelect";
import { DocxImportActionButton } from "@/components/paper/DocxImportActionButton";
import { NewManuscriptModal } from "@/components/paper/NewManuscriptModal";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { usePaperList } from "@/lib/usePaperList";
import type { ModelNode } from "@/lib/modelTree";
import { deletePaper, type DocumentType } from "@/modelApi";

function ManuscriptActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="sidebar-pane-icon-btn shrink-0 p-0"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function PaperSelectorBar({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  showImportAction = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged?: () => void;
  onError: (message: string) => void;
  showImportAction?: boolean;
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
      setDeleteSlug(null);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col gap-1">
        <DocTypeFilterChips value={docTypeFilter} onChange={setDocTypeFilter} />
        <PaperSelect
          papers={papers}
          selectedSlug={selectedSlug}
          loading={loading}
          docTypeFilter={docTypeFilter}
          className="w-full"
          onChange={handlePaperChange}
        />
        <div className="flex justify-center">
          <div className="flex items-center gap-0">
            <ManuscriptActionButton
              label="Edit manuscript"
              disabled={!selectedSlug || deleting}
              onClick={() => selectedSlug && setEditSlug(selectedSlug)}
            >
              <Pencil className="sidebar-pane-icon" aria-hidden="true" />
            </ManuscriptActionButton>
            <ManuscriptActionButton
              label="Delete manuscript"
              disabled={!selectedSlug || deleting}
              onClick={() => selectedSlug && setDeleteSlug(selectedSlug)}
            >
              <Trash2 className="sidebar-pane-icon text-destructive" aria-hidden="true" />
            </ManuscriptActionButton>
            <ManuscriptActionButton label="New manuscript" onClick={() => setShowNewPaper(true)}>
              <Plus className="sidebar-pane-icon" aria-hidden="true" />
            </ManuscriptActionButton>
            {showImportAction && selectedSlug ? (
              <DocxImportActionButton iconOnly paperSlug={selectedSlug} className="sidebar-pane-icon-btn shrink-0 p-0" />
            ) : null}
          </div>
        </div>
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
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteSlug(null)}
      />
    </>
  );
}
