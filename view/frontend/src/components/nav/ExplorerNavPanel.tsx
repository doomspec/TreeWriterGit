import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, Lightbulb, Search } from "lucide-react";

import { SearchResults } from "@/components/layout/SearchResults";
import { cn } from "@/lib/utils";
import {
  OUTLINE_DOC,
  displayFileLabel,
  filterTree,
  transformTreeForDisplay,
  type ModelNode,
} from "@/lib/modelTree";
import type { SearchHit } from "@/modelApi";

function FileTreeNode({
  node,
  depth,
  currentPath,
  activeFile,
  expanded,
  onToggle,
  onNavigate,
  onOpenFile,
}: {
  node: ModelNode;
  depth: number;
  currentPath: string;
  activeFile: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const isDir = node.type === "directory";
  const isOpen = expanded.has(node.path);
  const isActive =
    currentPath === node.path ||
    currentPath.startsWith(`${node.path}/`) ||
    activeFile === node.path;

  if (!isDir) {
    const label = displayFileLabel(node.name);
    if (!label) return null;
    const isOutline = node.name === OUTLINE_DOC;
    const isDraft = node.name === "draft.md";
    return (
      <li>
        <button
          type="button"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={cn(
            "ui-nav-row pr-2",
            isActive ? "ui-nav-row-active" : "ui-nav-row-inactive",
            isOutline && "text-primary/90",
          )}
          onClick={() => onOpenFile(node.path)}
        >
          {isOutline ? (
            <Lightbulb className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
          ) : (
            <FileText className={cn("h-3.5 w-3.5 shrink-0 opacity-60", isDraft && "opacity-80")} aria-hidden="true" />
          )}
          <span className="truncate">{label}</span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center">
        <button
          type="button"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          className="flex h-6 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={() => onToggle(node.path)}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            "ui-nav-row min-w-0 flex-1 pr-2",
            isActive ? "ui-nav-row-active" : "ui-nav-row-inactive",
          )}
          onClick={() => onNavigate(node.path)}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {isOpen && node.children && node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              activeFile={activeFile}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function expandPathSegments(path: string): string[] {
  if (!path) return [];
  const parts = path.split("/").filter(Boolean);
  const segments: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    segments.push(parts.slice(0, i + 1).join("/"));
  }
  return segments;
}

export function ExplorerNavPanel({
  tree,
  currentPath,
  activeFile,
  searchQuery,
  onSearchChange,
  onSearchSelect,
  onNavigate,
  onOpenFile,
  embedded = false,
}: {
  tree: ModelNode[];
  currentPath: string;
  activeFile: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  embedded?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));

  const filteredTree = useMemo(
    () => transformTreeForDisplay(filterTree(tree, searchQuery)),
    [searchQuery, tree],
  );

  useEffect(() => {
    const segments = expandPathSegments(currentPath);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add("");
      for (const segment of segments) next.add(segment);
      return next;
    });
  }, [currentPath]);

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const treeProps = {
    currentPath,
    activeFile,
    expanded,
    onToggle: toggleExpanded,
    onNavigate,
    onOpenFile,
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded ? "min-h-0 flex-1 overflow-hidden" : "border-r border-border bg-sidebar",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search model…"
            value={searchQuery}
            className="ui-input pl-8"
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {onSearchSelect ? (
          <SearchResults query={searchQuery} onSelect={onSearchSelect} />
        ) : null}
        </div>

        <div className="p-2">
          <button
            type="button"
            className={cn(
              "ui-nav-row mb-1",
              currentPath === "" ? "ui-nav-row-active" : "ui-nav-row-inactive",
            )}
            onClick={() => onNavigate("")}
          >
            <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>model</span>
          </button>
          {filteredTree.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">No matches.</p>
          ) : (
            <ul className="space-y-0.5">
              {filteredTree.map((node) => (
                <FileTreeNode key={node.path} node={node} depth={0} {...treeProps} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
