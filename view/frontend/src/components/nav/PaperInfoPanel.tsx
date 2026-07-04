import { useState } from "react";
import { BookUser, Info, Plus, Users } from "lucide-react";

import { authorFullName } from "@treewriter/shared";

import { SidebarCollapsibleSection } from "@/components/layout/SidebarCollapsibleSection";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import {
  hasAuthorContent,
  PaperAuthorsSection,
} from "@/components/nav/paperInfo/PaperAuthorsSection";
import { buildUpdatePayload, PaperInfoContent } from "@/components/nav/paperInfo/PaperInfoRows";
import { usePaperDetail } from "@/lib/usePaperDetail";
import { NewManuscriptModal } from "@/components/paper/NewManuscriptModal";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModelNode } from "@/lib/modelTree";
import { updateManuscript } from "@/modelApi";

/** Unified Paper panel: selector, CRUD, stats, authors, affiliations, CRediT. */
export function PaperInfoPanel({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  className,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editAuthorsTab, setEditAuthorsTab] = useState(false);
  const [removeAuthorIndex, setRemoveAuthorIndex] = useState<number | null>(null);
  const [removingAuthor, setRemovingAuthor] = useState(false);
  const selectedSlug = paperSlugFromPath(currentPath);

  const { detail, detailLoading, reloadDetail } = usePaperDetail(
    selectedSlug,
    refreshVersion,
    onError,
  );

  const removeAuthorName =
    removeAuthorIndex != null && detail
      ? authorFullName(detail.authorDetails[removeAuthorIndex] ?? {}).trim()
      : "";

  const handleRemoveAuthorConfirm = async () => {
    if (!detail || removeAuthorIndex == null) return;
    setRemovingAuthor(true);
    try {
      const nextAuthors = detail.authorDetails.filter((_, index) => index !== removeAuthorIndex);
      await updateManuscript(buildUpdatePayload(detail, nextAuthors));
      await reloadDetail();
      onModelChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingAuthor(false);
      setRemoveAuthorIndex(null);
    }
  };

  const openAuthorsEditor = () => {
    if (!detail) return;
    setEditAuthorsTab(true);
    setEditSlug(detail.slug);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-y-auto", className)}>
      <SidebarCollapsibleSection
        title="Manuscript"
        icon={BookUser}
        first
        defaultOpen
        contentClassName="space-y-1 px-2 pb-2 pt-0"
      >
        <PaperSelectorBar
          tree={tree}
          currentPath={currentPath}
          refreshVersion={refreshVersion}
          onNavigate={onNavigate}
          onPaperCreated={onPaperCreated}
          onModelChanged={onModelChanged}
          onError={onError}
          showImportAction
        />
        {!selectedSlug ? (
          <p className="text-[10px] leading-snug text-muted-foreground">Select a paper to see its details.</p>
        ) : null}
      </SidebarCollapsibleSection>

      {selectedSlug && detailLoading && !detail ? (
        <SidebarCollapsibleSection title="Info" icon={Info}>
          <p className="text-[11px] text-muted-foreground">Loading paper details…</p>
        </SidebarCollapsibleSection>
      ) : null}

      {detail ? (
        <>
          <SidebarCollapsibleSection title="Info" icon={Info} defaultOpen>
            <PaperInfoContent detail={detail} />
          </SidebarCollapsibleSection>
          <SidebarCollapsibleSection
            title="Authors"
            icon={Users}
            defaultOpen
            headerActions={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sidebar-pane-icon-btn h-7 w-7"
                title="Add author"
                aria-label="Add author"
                onClick={openAuthorsEditor}
              >
                <Plus className="sidebar-pane-icon" aria-hidden="true" />
              </Button>
            }
          >
            {hasAuthorContent(detail) ? (
              <PaperAuthorsSection
                detail={detail}
                onEdit={openAuthorsEditor}
                onRemove={setRemoveAuthorIndex}
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">No authors listed.</p>
            )}
          </SidebarCollapsibleSection>
        </>
      ) : null}

      {editSlug ? (
        <NewManuscriptModal
          editSlug={editSlug}
          initialTab={editAuthorsTab ? "authors" : "details"}
          onClose={() => {
            setEditSlug(null);
            setEditAuthorsTab(false);
          }}
          onCreated={(path) => {
            setEditSlug(null);
            setEditAuthorsTab(false);
            onModelChanged();
            onPaperCreated(path);
            void reloadDetail();
          }}
          onError={onError}
        />
      ) : null}

      <ConfirmDialog
        open={removeAuthorIndex !== null}
        title="Remove author?"
        message={
          removeAuthorName
            ? `Remove "${removeAuthorName}" from this manuscript?`
            : "Remove this author from the manuscript?"
        }
        confirmLabel={removingAuthor ? "Removing…" : "Remove author"}
        destructive
        loading={removingAuthor}
        onConfirm={() => void handleRemoveAuthorConfirm()}
        onCancel={() => setRemoveAuthorIndex(null)}
      />
    </div>
  );
}
