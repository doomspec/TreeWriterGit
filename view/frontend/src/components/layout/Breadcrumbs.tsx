import { useMemo } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";

import { PopoverMenu, PopoverMenuItem, PopoverMenuSection } from "@/components/ui/PopoverMenu";
import { cn } from "@/lib/utils";
import { useFolderChildOrder } from "@/lib/useFolderChildOrder";
import {
  breadcrumbSegments,
  childCardsForFolder,
  findNode,
  isUnitFolder,
  outlinePathFor,
  papersBreadcrumbSegments,
  type ModelNode,
  type OutlineItem,
} from "@/lib/modelTree";

function navigateOutlineItem(
  item: OutlineItem,
  tree: ModelNode[],
  onNavigate: (path: string) => void,
  onOpenFile: (path: string) => void,
) {
  if (item.kind === "directory") {
    const node = findNode(tree, item.path);
    if (isUnitFolder(node)) {
      onOpenFile(outlinePathFor(item.path));
      return;
    }
    onNavigate(item.path);
    return;
  }
  onOpenFile(item.path);
}

function ActiveSectionNav({
  label,
  folderPath,
  tree,
  refreshVersion,
  onNavigate,
  onOpenFile,
  compact,
}: {
  label: string;
  folderPath: string;
  tree: ModelNode[];
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  compact: boolean;
}) {
  const childOrder = useFolderChildOrder(folderPath, refreshVersion);
  const navItems = useMemo(
    () => childCardsForFolder(tree, folderPath, childOrder).filter((item) => item.kind === "directory"),
    [childOrder, folderPath, tree],
  );

  if (navItems.length === 0) {
    return (
      <span
        className={cn(
          "truncate rounded px-1 py-0.5 font-medium text-foreground",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <PopoverMenu
      align="start"
      aria-label={`Navigate within ${label}`}
      menuClassName="max-h-[min(24rem,60vh)] overflow-y-auto min-w-[14rem]"
      triggerClassName={cn(
        "gap-0.5 font-medium text-foreground hover:bg-accent hover:text-foreground",
        compact ? "text-xs" : "text-sm",
      )}
      trigger={(open) => (
        <>
          <span className="truncate">{label}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </>
      )}
    >
      <PopoverMenuSection label="Subsections & units">
        {navItems.map((item) => {
          const node = findNode(tree, item.path);
          const kindLabel = isUnitFolder(node) ? "Unit" : "Section";
          return (
            <PopoverMenuItem
              key={item.id}
              onClick={() => navigateOutlineItem(item, tree, onNavigate, onOpenFile)}
            >
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.name.replace(/\.md$/, "")}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {kindLabel}
              </span>
            </PopoverMenuItem>
          );
        })}
      </PopoverMenuSection>
    </PopoverMenu>
  );
}

export function Breadcrumbs({
  path,
  onNavigate,
  compact = false,
  variant = "default",
  tree,
  refreshVersion = 0,
  onOpenFile,
}: {
  path: string;
  onNavigate: (path: string) => void;
  compact?: boolean;
  variant?: "default" | "papers";
  tree?: ModelNode[];
  refreshVersion?: number;
  onOpenFile?: (path: string) => void;
}) {
  const segments = variant === "papers" ? papersBreadcrumbSegments(path) : breadcrumbSegments(path);
  const showSectionNav = Boolean(tree && onOpenFile);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 items-center gap-0.5", compact ? "text-xs" : "text-sm")}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={segment.path || "root"} className="flex min-w-0 items-center gap-0.5">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            ) : null}
            {isLast && showSectionNav ? (
              <ActiveSectionNav
                label={segment.label}
                folderPath={segment.path}
                tree={tree!}
                refreshVersion={refreshVersion}
                onNavigate={onNavigate}
                onOpenFile={onOpenFile!}
                compact={compact}
              />
            ) : (
              <button
                type="button"
                disabled={isLast}
                className={cn(
                  "truncate rounded px-1 py-0.5 font-medium transition-colors",
                  isLast
                    ? "cursor-default text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                onClick={() => !isLast && onNavigate(segment.path)}
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
