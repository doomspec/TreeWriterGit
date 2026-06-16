import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, Lightbulb, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PAPERS_ROOT,
  childrenOf,
  displayFileLabel,
  filterTree,
  OUTLINE_DOC,
  parentPath,
  transformTreeForDisplay,
  type ModelNode,
} from "@/lib/modelTree";
import { SearchResults } from "@/components/layout/SearchResults";
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
  onOpenFile?: (path: string) => void;
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
            "flex h-7 w-full items-center gap-2 pr-2 text-left text-xs hover:bg-accent/60",
            isActive ? "bg-accent/80 font-medium text-accent-foreground" : "text-muted-foreground",
            isOutline && "text-primary/90",
          )}
          onClick={() => {
            if (onOpenFile && node.name.endsWith(".md")) {
              onOpenFile(node.path);
            } else {
              onNavigate(parentPath(node.path));
            }
          }}
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
            "flex h-7 min-w-0 flex-1 items-center gap-2 pr-2 text-left text-xs hover:bg-accent/60",
            isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
          )}
          onClick={() => onNavigate(node.path)}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {isOpen && node.children && node.children.length > 0 ? (
        <ul>
          {transformTreeForDisplay(node.children).map((child) => (
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

export type SidebarTab = "explorer" | "papers" | "graph";

export function Sidebar({
  tree,
  currentPath,
  activeFile,
  activeTab,
  searchQuery,
  onTabChange,
  onSearchChange,
  onNavigate,
  onOpenFile,
  onSearchSelect,
  papersContent,
  graphContent,
}: {
  tree: ModelNode[];
  currentPath: string;
  activeFile: string | null;
  activeTab: SidebarTab;
  searchQuery: string;
  onTabChange: (tab: SidebarTab) => void;
  onSearchChange: (query: string) => void;
  onNavigate: (path: string) => void;
  onOpenFile?: (path: string) => void;
  onSearchSelect?: (hit: SearchHit) => void;
  papersContent: React.ReactNode;
  graphContent: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([PAPERS_ROOT]));

  const filteredTree = useMemo(
    () => transformTreeForDisplay(filterTree(tree, searchQuery)),
    [searchQuery, tree],
  );
  const papersChildren = useMemo(() => childrenOf(tree, PAPERS_ROOT), [tree]);
  const filteredPapersTree = useMemo(
    () => transformTreeForDisplay(filterTree(papersChildren, searchQuery)),
    [papersChildren, searchQuery],
  );
  const hasPapersFolder = useMemo(
    () => tree.some((n) => n.path === PAPERS_ROOT || n.name === "papers"),
    [tree],
  );

  useEffect(() => {
    const segments = expandPathSegments(currentPath);
    if (segments.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
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

  const tabs: { id: SidebarTab; label: string }[] = [
    { id: "explorer", label: "Explorer" },
    { id: "papers", label: "Papers" },
    { id: "graph", label: "Graph" },
  ];

  const treeProps = {
    currentPath,
    activeFile,
    expanded,
    onToggle: toggleExpanded,
    onNavigate,
    onOpenFile,
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={activeTab === "papers" ? "Search papers…" : "Search model…"}
            value={searchQuery}
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none ring-primary focus:ring-1"
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {onSearchSelect ? (
          <SearchResults
            query={searchQuery}
            root={activeTab === "papers" ? PAPERS_ROOT : undefined}
            onSelect={onSearchSelect}
          />
        ) : null}
      </div>

      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "flex-1 border-b-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "explorer" ? (
          <div className="p-2">
            <button
              type="button"
              className={cn(
                "mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium hover:bg-accent/60",
                currentPath === "" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
              onClick={() => onNavigate("")}
            >
              <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>model</span>
            </button>
            <ul className="space-y-0.5">
              {filteredTree.map((node) => (
                <FileTreeNode key={node.path} node={node} depth={0} {...treeProps} />
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "papers" ? (
          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-border">{papersContent}</div>
            <div className="p-2">
              <button
                type="button"
                className={cn(
                  "mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium hover:bg-accent/60",
                  currentPath === PAPERS_ROOT ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
                onClick={() => onNavigate(PAPERS_ROOT)}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>papers</span>
              </button>
              {!hasPapersFolder ? (
                <p className="px-2 py-1 text-[11px] text-muted-foreground">No papers folder in model yet.</p>
              ) : filteredPapersTree.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-muted-foreground">No matches.</p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredPapersTree.map((node) => (
                    <FileTreeNode key={node.path} node={node} depth={0} {...treeProps} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "graph" ? (
          <div className="graph-tab-host flex min-h-[280px] flex-1 flex-col overflow-hidden">
            {graphContent}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
