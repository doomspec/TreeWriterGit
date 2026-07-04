import { Copy, FolderTree, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { TREE_ROW_CREATE_ICONS, type TreeRowCreateOption } from "@/components/nav/TreeRowActions";
import { PopoverMenu, PopoverMenuItem } from "@/components/ui/PopoverMenu";
import { UNIT_STATUS_COUNTS_HINT } from "@/lib/unapprovedHighlight";
import { canAddManuscriptChildren, findNode, isUnitFolder, type ModelNode } from "@/lib/modelTree";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import type { NodeKind } from "@/modelApi";
import type { UnitStatusCounts } from "@/modelApi";

function createMenuOptions(
  createParentPath: string,
  paperPath: string,
  tree: ModelNode[],
): TreeRowCreateOption[] | null {
  const node = findNode(tree, createParentPath);
  if (!canAddManuscriptChildren(node, createParentPath, paperPath)) return null;
  const atPaperRoot = createParentPath === paperPath;
  return atPaperRoot
    ? [{ kind: "section", label: "Add section", Icon: TREE_ROW_CREATE_ICONS.section }]
    : [
        { kind: "unit", label: "Add unit", Icon: TREE_ROW_CREATE_ICONS.unit },
        { kind: "subsection", label: "Add subsection", Icon: TREE_ROW_CREATE_ICONS.subsection },
      ];
}

/** Where new manuscript nodes should be created for a tree row. */
export function resolveSectionTreeCreateParent(
  rowPath: string,
  listParentPath: string,
  tree: ModelNode[],
  paperPath: string,
): string {
  const rowNode = findNode(tree, rowPath);
  if (canAddManuscriptChildren(rowNode, rowPath, paperPath)) return rowPath;
  return listParentPath;
}

function SectionRowInfo({
  counts,
  wordCount,
  assignedUnresolvedCount = 0,
}: {
  counts?: UnitStatusCounts;
  wordCount?: number;
  assignedUnresolvedCount?: number;
}) {
  if (!counts && wordCount === undefined && assignedUnresolvedCount <= 0) return null;

  return (
    <div
      className="space-y-0.5 border-b border-border px-2.5 py-1.5 text-[10px] text-muted-foreground"
      role="presentation"
    >
      {counts ? (
        <p title={UNIT_STATUS_COUNTS_HINT}>
          {counts.approved}a · {counts.drafted}d · {counts.outline}o
        </p>
      ) : null}
      {wordCount !== undefined ? <p>{wordCount.toLocaleString()} words</p> : null}
      {assignedUnresolvedCount > 0 ? (
        <p className="text-primary">
          {assignedUnresolvedCount} assigned comment{assignedUnresolvedCount === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}

function SectionRowOverflowMenu({
  createParentPath,
  paperPath,
  tree,
  title,
  counts,
  wordCount,
  assignedUnresolvedCount = 0,
  disabled,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onConvertToSubsection,
  showRename = true,
  showDelete = true,
}: {
  createParentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  counts?: UnitStatusCounts;
  wordCount?: number;
  assignedUnresolvedCount?: number;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConvertToSubsection?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const createOptions = createMenuOptions(createParentPath, paperPath, tree);
  const hasRename = showRename && onRename;
  const hasDelete = showDelete && onDelete;
  const hasDuplicate = Boolean(onDuplicate);
  const hasConvert = Boolean(onConvertToSubsection);
  const hasActions = createOptions?.length || hasRename || hasDelete || hasDuplicate || hasConvert;
  const hasMeta =
    Boolean(counts) || wordCount !== undefined || assignedUnresolvedCount > 0;

  if (!hasActions && !hasMeta) return null;

  return (
    <PopoverMenu
      align="end"
      disabled={disabled}
      title={`Actions for ${title}`}
      aria-label={`Actions for ${title}`}
      triggerClassName="sidebar-pane-icon-btn relative z-[2] h-6 w-6 p-0 text-muted-foreground"
      menuClassName="min-w-[10rem] p-0"
      trigger={<MoreHorizontal className="sidebar-pane-icon" aria-hidden="true" />}
    >
      <SectionRowInfo
        counts={counts}
        wordCount={wordCount}
        assignedUnresolvedCount={assignedUnresolvedCount}
      />
      {createOptions?.map(({ kind, label, Icon }) => (
        <PopoverMenuItem key={kind} onClick={() => onCreate(createParentPath, kind)}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {label}
        </PopoverMenuItem>
      )) ?? null}
      {hasDuplicate ? (
        <PopoverMenuItem onClick={() => onDuplicate?.()}>
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          Duplicate
        </PopoverMenuItem>
      ) : null}
      {hasConvert ? (
        <PopoverMenuItem onClick={() => onConvertToSubsection?.()}>
          <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          Convert to subsection
        </PopoverMenuItem>
      ) : null}
      {hasRename ? (
        <PopoverMenuItem onClick={() => onRename?.()}>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          Rename
        </PopoverMenuItem>
      ) : null}
      {hasDelete ? (
        <PopoverMenuItem className="text-destructive hover:text-destructive" onClick={() => onDelete?.()}>
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Remove
        </PopoverMenuItem>
      ) : null}
    </PopoverMenu>
  );
}

export function SectionTreeRowMeta({
  createParentPath,
  paperPath,
  tree,
  title,
  rowPath,
  counts,
  wordCount,
  disabled,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onConvertToSubsection,
  showRename = true,
  showDelete = true,
}: {
  createParentPath: string;
  paperPath: string;
  tree: ModelNode[];
  title: string;
  rowPath: string;
  counts?: UnitStatusCounts;
  wordCount?: number;
  disabled?: boolean;
  onCreate: (parentPath: string, kind: NodeKind) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConvertToSubsection?: () => void;
  showRename?: boolean;
  showDelete?: boolean;
}) {
  const { assignedCountsByFolder } = useWorkspaceNavigationContext();
  const assignedUnresolvedCount = assignedCountsByFolder.get(rowPath) ?? 0;
  const canConvert = isUnitFolder(findNode(tree, rowPath)) && onConvertToSubsection;

  return (
    <div className="section-tree-row__meta shrink-0 pr-0.5">
      <SectionRowOverflowMenu
        createParentPath={createParentPath}
        paperPath={paperPath}
        tree={tree}
        title={title}
        counts={counts}
        wordCount={wordCount}
        assignedUnresolvedCount={assignedUnresolvedCount}
        disabled={disabled}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onConvertToSubsection={canConvert ? () => onConvertToSubsection?.() : undefined}
        showRename={showRename}
        showDelete={showDelete}
      />
    </div>
  );
}
