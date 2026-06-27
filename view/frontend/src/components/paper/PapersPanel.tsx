import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { paperSlugFromPath } from "@/components/nav/PaperSelect";
import { PaperInfoLine } from "@/components/nav/PaperInfoLine";
import { PaperSelectorBar } from "@/components/nav/PaperSelectorBar";
import { SectionTreeRowMeta } from "@/components/paper/SectionTreeRowMeta";
import {
  SectionOrderList,
  sectionTreeNavButtonClassName,
  type SectionRow,
} from "@/components/paper/PaperSectionTree";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { UnapprovedIndicator } from "@/components/nav/UnapprovedIndicator";
import { cn } from "@/lib/utils";
import { useDraftPendingPaths, replaceServerDraftPendingPaths } from "@/lib/draftPendingStore";
import { sectionNeedsHighlight, unapprovedSectionRowClass, unapprovedSectionTitle } from "@/lib/unapprovedHighlight";
import { loadIndexChildOrder } from "@/lib/indexChildOrder";
import { navigateAfterArchive, useArchiveNodeDialog } from "@/lib/useArchiveNodeDialog";
import {
  createNode,
  fetchPaperDetail,
  moveNode,
  reorderChildren,
  type NodeKind,
  type PaperDetail,
} from "@/modelApi";
import { sectionsForPaper } from "@/lib/modelTree";
import { usePaperList } from "@/lib/usePaperList";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { defaultPaperPath } from "@/lib/defaultGuidePaper";

type CreatePrompt = {
  parentPath: string;
  kind: NodeKind;
};

type RenameTarget = {
  path: string;
  label: string;
};

function isPathUnderAncestor(currentPath: string, ancestorPath: string): boolean {
  return currentPath === ancestorPath || currentPath.startsWith(`${ancestorPath}/`);
}

function ancestorFolderPaths(folderPath: string, paperPath: string): string[] {
  if (!folderPath.startsWith(paperPath)) return [];
  if (folderPath === paperPath) return [];
  const relative = folderPath.slice(paperPath.length + 1);
  const paths: string[] = [];
  let acc = paperPath;
  for (const part of relative.split("/").filter(Boolean)) {
    acc = `${acc}/${part}`;
    paths.push(acc);
  }
  return paths;
}

export function PapersPanel({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onModelChanged,
  onError,
  embedded = false,
  hidePaperHeader = false,
}: {
  tree: import("@/lib/modelTree").ModelNode[];
  currentPath: string;
  refreshVersion?: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onModelChanged?: () => void;
  onError: (message: string) => void;
  embedded?: boolean;
  hidePaperHeader?: boolean;
}) {
  const { papers, loading: papersLoading } = usePaperList(tree, refreshVersion ?? 0, onError);
  useDraftPendingPaths();
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [childOrderOverrides, setChildOrderOverrides] = useState<Record<string, string[]>>({});
  const { commentSummary, paperChildOrders } = useWorkspaceNavigationContext();
  const childOrders = useMemo(
    () => ({ ...paperChildOrders, ...childOrderOverrides }),
    [childOrderOverrides, paperChildOrders],
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [createPrompt, setCreatePrompt] = useState<CreatePrompt | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const previousPathRef = useRef(currentPath);

  const selectedSlug = useMemo(() => paperSlugFromPath(currentPath), [currentPath]);
  const paperPath = selectedSlug ? `papers/${selectedSlug}` : null;

  useEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = currentPath;
    if (previousPath === currentPath || !paperPath) return;

    setCollapsedPaths((prev) => {
      const ancestors = ancestorFolderPaths(currentPath, paperPath);
      let next: Set<string> | null = null;
      for (const path of ancestors) {
        if (prev.has(path)) {
          next ??= new Set(prev);
          next.delete(path);
        }
      }
      return next ?? prev;
    });
  }, [currentPath, paperPath]);

  const isBranchExpanded = useCallback(
    (folderPath: string) => {
      if (!paperPath || !isPathUnderAncestor(currentPath, folderPath)) return false;
      return !collapsedPaths.has(folderPath);
    },
    [collapsedPaths, currentPath, paperPath],
  );

  const onTreeItemClick = useCallback(
    (path: string) => {
      if (currentPath === path) {
        setCollapsedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        return;
      }

      setCollapsedPaths((prev) => {
        if (!prev.has(path)) return prev;
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      onNavigate(path);
    },
    [currentPath, onNavigate],
  );

  const showSectionList =
    Boolean(paperPath) && (currentPath !== paperPath || !collapsedPaths.has(paperPath));

  const requestCreate = useCallback((parentPath: string, kind: NodeKind) => {
    setCreatePrompt({ parentPath, kind });
  }, []);

  const requestRename = useCallback((path: string, label: string) => {
    setRenameTarget({ path, label });
  }, []);

  const loadSectionOrder = useCallback(
    async (path: string) => {
      const order =
        childOrders[path]?.length ? childOrders[path] : await loadIndexChildOrder(path);
      setSectionOrder(order);
      return order;
    },
    [childOrders],
  );

  const submitCreate = useCallback(
    async (name: string) => {
      if (!createPrompt) return;
      const { parentPath, kind } = createPrompt;
      setCreatePrompt(null);
      try {
        const created = await createNode(parentPath, name, kind);
        onModelChanged?.();
        onNavigate(created.path);
        const order = await loadIndexChildOrder(parentPath);
        setChildOrderOverrides((prev) => ({ ...prev, [parentPath]: order }));
        if (paperPath && parentPath === paperPath) {
          await loadSectionOrder(paperPath);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [createPrompt, loadSectionOrder, onError, onModelChanged, onNavigate, paperPath],
  );

  const reload = useCallback(async () => {
    setDetailLoading(true);
    try {
      if (selectedSlug && paperPath) {
        await loadSectionOrder(paperPath);
        try {
          const data = await fetchPaperDetail(selectedSlug);
          setDetail(data.paper);
          replaceServerDraftPendingPaths(data.paper.pendingApprovalPaths ?? []);
        } catch {
          setDetail(null);
          replaceServerDraftPendingPaths([]);
        }
      } else {
        setDetail(null);
        setSectionOrder([]);
        setChildOrderOverrides({});
        replaceServerDraftPendingPaths([]);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }, [loadSectionOrder, onError, paperPath, selectedSlug]);

  const handleModelChanged = useCallback(() => {
    onModelChanged?.();
    void reload();
  }, [onModelChanged, reload]);

  const submitRename = useCallback(
    async (nextName: string) => {
      if (!renameTarget) return;
      const { path } = renameTarget;
      setRenameTarget(null);
      const current = path.split("/").at(-1) ?? "";
      if (nextName === current) return;
      const parent = path.split("/").slice(0, -1).join("/");
      const to = `${parent}/${nextName}`;
      try {
        await moveNode(path, to);
        if (currentPath === path || currentPath.startsWith(`${path}/`)) {
          onNavigate(currentPath.replace(path, to));
        }
        handleModelChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentPath, handleModelChanged, onError, onNavigate, renameTarget],
  );

  const { requestArchive, dialogs: archiveDialogs } = useArchiveNodeDialog({
    onChanged: handleModelChanged,
    onError,
    onArchived: (path) => navigateAfterArchive(path, currentPath, onNavigate),
  });

  useEffect(() => {
    void reload();
  }, [reload, currentPath, refreshVersion]);

  useEffect(() => {
    if (papersLoading || detailLoading || selectedSlug || papers.length === 0) return;
    if (currentPath === "papers" || currentPath === "") {
      onNavigate(defaultPaperPath(papers));
    }
  }, [currentPath, detailLoading, onNavigate, papers, papersLoading, selectedSlug]);

  const containerCounts = detail?.containerCounts ?? {};

  const paperHighlight = paperPath
    ? sectionNeedsHighlight(paperPath, containerCounts[paperPath] ?? detail?.counts)
    : { highlight: false, pending: false, unapproved: false };

  const sections = useMemo((): SectionRow[] => {
    if (!paperPath) return [];
    const fromTree = sectionsForPaper(tree, paperPath, sectionOrder);
    if (!detail?.sections.length) return fromTree;
    const byPath = new Map(detail.sections.map((s) => [s.path, s]));
    return fromTree.map((s) => ({
      ...s,
      title: byPath.get(s.path)?.title ?? s.title,
      counts: byPath.get(s.path)?.counts,
    }));
  }, [detail, paperPath, sectionOrder, tree]);

  const handleSectionReorder = async (order: string[]) => {
    if (!paperPath) return;
    setReordering(true);
    try {
      await reorderChildren(paperPath, order);
      setSectionOrder(order);
      onModelChanged?.();
      await loadSectionOrder(paperPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
  };

  const handleChildReorder = async (parentPath: string, order: string[]) => {
    setReordering(true);
    try {
      await reorderChildren(parentPath, order);
      setChildOrderOverrides((prev) => ({ ...prev, [parentPath]: order }));
      onModelChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className={cn("space-y-3", embedded ? "p-3 pt-0" : "border-b border-border px-4 py-3")}>
      {!hidePaperHeader ? (
        <PaperSelectorBar
          tree={tree}
          currentPath={currentPath}
          refreshVersion={refreshVersion ?? 0}
          onNavigate={onNavigate}
          onPaperCreated={onPaperCreated}
          onModelChanged={onModelChanged}
          onError={onError}
        />
      ) : null}

      {papersLoading && papers.length === 0 ? (
        <LoadingSkeleton className="px-1 py-2" lines={5} />
      ) : null}

      {detailLoading && !detail ? (
        <LoadingSkeleton className="px-1 py-2" lines={4} />
      ) : null}

      {detail && !hidePaperHeader ? (
        <PaperInfoLine
          slug={selectedSlug}
          refreshVersion={refreshVersion ?? 0}
          onError={onError}
          commentSummary={commentSummary}
        />
      ) : null}

      {selectedSlug && paperPath ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div
              className={cn(
                "section-tree-row flex items-stretch gap-0.5 rounded-md border border-border/60 bg-background",
                unapprovedSectionRowClass({
                  highlight: paperHighlight.highlight,
                  pending: paperHighlight.pending,
                  active: currentPath === paperPath,
                }),
                currentPath === paperPath ? "border-primary/40 bg-accent/50" : undefined,
              )}
            >
              <button
                type="button"
                className={sectionTreeNavButtonClassName({
                  active: currentPath === paperPath,
                  highlight: paperHighlight.highlight,
                  textSize: "text-xs",
                  rowPad: "py-1.5",
                })}
                onClick={() => onTreeItemClick(paperPath)}
              >
                <UnapprovedIndicator
                  pending={paperHighlight.pending}
                  unapproved={paperHighlight.unapproved}
                />
                <span
                  className={unapprovedSectionTitle(
                    "section-tree-row__title font-medium",
                    paperHighlight.highlight,
                  )}
                >
                  {detail?.title ?? "Paper overview"}
                </span>
                <span className="section-tree-row__meta-label shrink-0 text-[10px] text-muted-foreground">
                  Outline · Draft
                </span>
              </button>
              <SectionTreeRowMeta
                createParentPath={paperPath}
                paperPath={paperPath}
                tree={tree}
                title={detail?.title ?? "Paper overview"}
                rowPath={paperPath}
                disabled={reordering}
                onCreate={requestCreate}
                showRename={false}
                showDelete={false}
              />
            </div>
            {!hidePaperHeader ? (
              <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sections
              </p>
            ) : null}
            {sections.length === 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  No sections yet — use + on the paper row above to add a section.
                </p>
              </div>
            ) : showSectionList ? (
              <SectionOrderList
                sections={sections}
                paperPath={paperPath}
                currentPath={currentPath}
                tree={tree}
                childOrders={childOrders}
                containerCounts={containerCounts}
                reordering={reordering}
                isBranchExpanded={isBranchExpanded}
                onTreeItemClick={onTreeItemClick}
                onReorder={handleSectionReorder}
                onChildReorder={handleChildReorder}
                onDelete={requestArchive}
                onRename={requestRename}
                onCreate={requestCreate}
              />
            ) : null}
            {sections.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                Drag to reorder · click again on a selected folder to collapse · hover for + rename
                remove · ⋯ on narrow sidebar ·{" "}
                <span className="text-amber-700 dark:text-amber-300">amber = unapproved text</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : papers.length === 0 && !papersLoading ? (
        <p className="text-xs text-muted-foreground">Create a paper to get started.</p>
      ) : null}

      {archiveDialogs}

      <NamePromptDialog
        open={createPrompt !== null}
        title={createPrompt ? `New ${createPrompt.kind}` : "New node"}
        label="Folder-safe name (lowercase, hyphens ok)"
        confirmLabel="Create"
        onConfirm={(name) => void submitCreate(name)}
        onCancel={() => setCreatePrompt(null)}
      />
      <NamePromptDialog
        open={renameTarget !== null}
        title="Rename"
        label="Folder-safe name (lowercase, hyphens ok)"
        defaultValue={renameTarget?.path.split("/").at(-1) ?? ""}
        confirmLabel="Rename"
        onConfirm={(name) => void submitRename(name)}
        onCancel={() => setRenameTarget(null)}
      />
    </div>
  );
}
