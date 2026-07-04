import { useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Merge,
  Plus,
  Trash2,
} from "lucide-react";

import { NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addImportPlanContainer,
  addImportPlanUnit,
  canMoveImportPlanNode,
  deleteImportPlanNode,
  mergeImportPlanUnits,
  moveImportPlanNode,
  reorderImportPlanNode,
} from "@/lib/docxImportPlanEdit";
import type { DocxImportPreviewNode } from "@treewriter/shared";

type AddPrompt =
  | { mode: "root-container"; kind: "section" | "subsection" }
  | { mode: "child-container"; parentPath: number[]; kind: "subsection" }
  | { mode: "unit"; parentPath: number[] };

function kindLabel(kind: DocxImportPreviewNode["kind"]): string {
  if (kind === "unit") return "unit";
  if (kind === "subsection") return "subsection";
  return "section";
}

function pathKey(path: number[]): string {
  return path.join(".");
}

function ImportPreviewRow({
  planNodes,
  node,
  path,
  depth,
  disabled,
  expandedPath,
  dragPath,
  overPath,
  onToggleExpand,
  onDelete,
  onMergeDown,
  onAddSubsection,
  onAddUnit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  planNodes: DocxImportPreviewNode[];
  node: DocxImportPreviewNode;
  path: number[];
  depth: number;
  disabled?: boolean;
  expandedPath: string | null;
  dragPath: number[] | null;
  overPath: number[] | null;
  onToggleExpand: (path: number[]) => void;
  onDelete: (path: number[]) => void;
  onMergeDown: (path: number[]) => void;
  onAddSubsection: (parentPath: number[]) => void;
  onAddUnit: (parentPath: number[]) => void;
  onDragStart: (path: number[]) => void;
  onDragOver: (path: number[]) => void;
  onDrop: (path: number[]) => void;
  onDragEnd: () => void;
}) {
  const key = pathKey(path);
  const isUnit = node.kind === "unit";
  const isExpanded = expandedPath === key;
  const isContainer = !isUnit;
  const index = path[path.length - 1] ?? 0;
  const dragging = dragPath !== null && pathKey(dragPath) === key;
  const over =
    overPath !== null &&
    pathKey(overPath) === key &&
    dragPath !== null &&
    pathKey(dragPath) !== key;
  const dropAllowed =
    dragPath !== null && canMoveImportPlanNode(planNodes, dragPath, path);
  const showDropHint = over && dropAllowed;
  const showDropBlocked = over && !dropAllowed;

  return (
    <li>
      <div
        className={cn(
          "group flex items-start gap-1 rounded px-1 py-1 text-[11px] leading-snug",
          "bg-primary/5 text-foreground",
          depth > 0 && "ml-3 border-l border-border pl-2",
          dragging && "opacity-50",
          showDropHint && (isContainer ? "ring-2 ring-primary/50 bg-primary/10" : "ring-1 ring-primary/40"),
          showDropBlocked && "ring-1 ring-destructive/40",
          disabled && "opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver(path);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(path);
        }}
      >
        <button
          type="button"
          className={cn(
            "mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-accent active:cursor-grabbing",
            disabled && "pointer-events-none",
          )}
          draggable={!disabled}
          title="Drag to reorder or move between sections"
          aria-label={`Drag ${node.title}`}
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart(path);
          }}
          onDragEnd={(event) => {
            event.stopPropagation();
            onDragEnd();
          }}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {isUnit ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Hide unit text" : "Show unit text"}
            disabled={disabled}
            onClick={() => onToggleExpand(path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 inline-block w-4 shrink-0" aria-hidden="true" />
        )}

        <span
          className={cn(
            "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
            isUnit ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {kindLabel(node.kind)}
        </span>

        <button
          type="button"
          className={cn("min-w-0 flex-1 text-left", isUnit && "hover:underline")}
          disabled={disabled || !isUnit}
          onClick={() => {
            if (isUnit) onToggleExpand(path);
          }}
        >
          <span className="font-medium">{node.title}</span>
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">{node.slug}</span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100">
          {isContainer ? (
            <>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Add subsection"
                aria-label={`Add subsection under ${node.title}`}
                disabled={disabled}
                onClick={() => onAddSubsection(path)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Add unit"
                aria-label={`Add unit under ${node.title}`}
                disabled={disabled}
                onClick={() => onAddUnit(path)}
              >
                <span className="px-0.5 text-[10px] font-semibold">U+</span>
              </button>
            </>
          ) : null}
          {isUnit ? (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Merge with next unit"
              aria-label={`Merge ${node.title} with next unit`}
              disabled={disabled}
              onClick={() => onMergeDown(path)}
            >
              <Merge className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Remove"
            aria-label={`Remove ${node.title}`}
            disabled={disabled}
            onClick={() => onDelete(path)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isUnit && isExpanded ? (
        <div
          className={cn(
            "mb-1 ml-10 mr-1 rounded border border-border bg-background px-2 py-1.5 text-[11px] leading-relaxed text-foreground",
            depth > 0 && "ml-[3.25rem]",
          )}
        >
          {(node.body ?? node.title).trim() || (
            <span className="italic text-muted-foreground">Empty unit</span>
          )}
        </div>
      ) : null}

      {node.children?.length ? (
        <ImportPreviewTree
          planNodes={planNodes}
          nodes={node.children}
          parentPath={path}
          depth={depth + 1}
          disabled={disabled}
          expandedPath={expandedPath}
          dragPath={dragPath}
          overPath={overPath}
          onToggleExpand={onToggleExpand}
          onDelete={onDelete}
          onMergeDown={onMergeDown}
          onAddSubsection={onAddSubsection}
          onAddUnit={onAddUnit}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ) : null}

      <span className="sr-only">{`Position ${index + 1}`}</span>
    </li>
  );
}

function ImportPreviewTree({
  planNodes,
  nodes,
  parentPath,
  depth,
  disabled,
  expandedPath,
  dragPath,
  overPath,
  onToggleExpand,
  onDelete,
  onMergeDown,
  onAddSubsection,
  onAddUnit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  planNodes: DocxImportPreviewNode[];
  nodes: DocxImportPreviewNode[];
  parentPath: number[];
  depth: number;
  disabled?: boolean;
  expandedPath: string | null;
  dragPath: number[] | null;
  overPath: number[] | null;
  onToggleExpand: (path: number[]) => void;
  onDelete: (path: number[]) => void;
  onMergeDown: (path: number[]) => void;
  onAddSubsection: (parentPath: number[]) => void;
  onAddUnit: (parentPath: number[]) => void;
  onDragStart: (path: number[]) => void;
  onDragOver: (path: number[]) => void;
  onDrop: (path: number[]) => void;
  onDragEnd: () => void;
}) {
  if (nodes.length === 0) {
    return (
      <p className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
        No items yet — add a section or subsection.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node, index) => (
        <ImportPreviewRow
          planNodes={planNodes}
          key={`${pathKey(parentPath)}-${node.slug}-${index}`}
          node={node}
          path={[...parentPath, index]}
          depth={depth}
          disabled={disabled}
          expandedPath={expandedPath}
          dragPath={dragPath}
          overPath={overPath}
          onToggleExpand={onToggleExpand}
          onDelete={onDelete}
          onMergeDown={onMergeDown}
          onAddSubsection={onAddSubsection}
          onAddUnit={onAddUnit}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}
    </ul>
  );
}

export function ImportPreviewEditor({
  nodes,
  topLevelKind,
  disabled,
  onChange,
}: {
  nodes: DocxImportPreviewNode[];
  topLevelKind: "section" | "subsection";
  disabled?: boolean;
  onChange: (nodes: DocxImportPreviewNode[]) => void;
}) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [dragPath, setDragPath] = useState<number[] | null>(null);
  const [overPath, setOverPath] = useState<number[] | null>(null);
  const [addPrompt, setAddPrompt] = useState<AddPrompt | null>(null);

  const finishDrag = useCallback(() => {
    setDragPath(null);
    setOverPath(null);
  }, []);

  const handleDrop = useCallback(
    (targetPath: number[]) => {
      if (!dragPath || disabled) {
        finishDrag();
        return;
      }
      if (pathKey(dragPath) === pathKey(targetPath)) {
        finishDrag();
        return;
      }

      const dragParent = dragPath.slice(0, -1);
      const targetParent = targetPath.slice(0, -1);
      const sameParent = pathKey(dragParent) === pathKey(targetParent);

      if (sameParent) {
        const fromIndex = dragPath[dragPath.length - 1] ?? 0;
        const toIndex = targetPath[targetPath.length - 1] ?? 0;
        onChange(reorderImportPlanNode(nodes, dragParent, fromIndex, toIndex));
      } else if (canMoveImportPlanNode(nodes, dragPath, targetPath)) {
        onChange(moveImportPlanNode(nodes, dragPath, targetPath));
      }

      finishDrag();
    },
    [disabled, dragPath, finishDrag, nodes, onChange],
  );

  const handleAddConfirm = (value: string) => {
    if (!addPrompt) return;
    let next = nodes;
    if (addPrompt.mode === "root-container") {
      next = addImportPlanContainer(nodes, null, addPrompt.kind, value);
    } else if (addPrompt.mode === "child-container") {
      next = addImportPlanContainer(nodes, addPrompt.parentPath, addPrompt.kind, value);
    } else {
      next = addImportPlanUnit(nodes, addPrompt.parentPath, value);
    }
    onChange(next);
    setAddPrompt(null);
  };

  const rootLabel = topLevelKind === "section" ? "section" : "subsection";

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={disabled}
          onClick={() => setAddPrompt({ mode: "root-container", kind: topLevelKind })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add {rootLabel}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Drag to reorder or drop onto a section to move units/subsections · click a unit to read
          its text
        </p>
      </div>

      <ImportPreviewTree
        planNodes={nodes}
        nodes={nodes}
        parentPath={[]}
        depth={0}
        disabled={disabled}
        expandedPath={expandedPath}
        dragPath={dragPath}
        overPath={overPath}
        onToggleExpand={(path) => {
          const key = pathKey(path);
          setExpandedPath((current) => (current === key ? null : key));
        }}
        onDelete={(path) => onChange(deleteImportPlanNode(nodes, path))}
        onMergeDown={(path) => onChange(mergeImportPlanUnits(nodes, path))}
        onAddSubsection={(parentPath) =>
          setAddPrompt({ mode: "child-container", parentPath, kind: "subsection" })
        }
        onAddUnit={(parentPath) => setAddPrompt({ mode: "unit", parentPath })}
        onDragStart={setDragPath}
        onDragOver={setOverPath}
        onDrop={handleDrop}
        onDragEnd={finishDrag}
      />

      <NamePromptDialog
        open={addPrompt !== null}
        title={
          addPrompt?.mode === "unit"
            ? "New unit"
            : addPrompt?.kind === "subsection"
              ? "New subsection"
              : "New section"
        }
        label="Title"
        confirmLabel="Add"
        onConfirm={handleAddConfirm}
        onCancel={() => setAddPrompt(null)}
      />
    </>
  );
}
