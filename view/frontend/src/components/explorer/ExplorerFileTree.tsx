import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { createFile, createFolder, deleteNode, fetchModelTree, moveNode } from "@/modelApi";
import type { ModelNode } from "@/lib/modelTree";
import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

type ContextTarget = { path: string; isDir: boolean } | null;
type PromptState =
  | { mode: "newFile" | "newFolder"; parent: string }
  | { mode: "rename"; path: string; isDir: boolean; current: string }
  | null;

/**
 * Lazy-loading project-root file tree for Explorer mode with create / rename /
 * delete for files and folders (right-click menu + header buttons), a settable
 * tree root, and auto-expand to the active file. Scoped to the model root by
 * the same path-hardened API the rest of the app uses.
 */
export function ExplorerFileTree({
  activeFile,
  refreshVersion = 0,
  onOpenFile,
  onError,
  onPathChange,
}: {
  activeFile: string | null;
  refreshVersion?: number;
  onOpenFile: (path: string) => void;
  onError?: (message: string) => void;
  /** Called after a rename (from,to) or delete (from,null) so open tabs can follow. */
  onPathChange?: (from: string, to: string | null) => void;
}) {
  const [rootPath, setRootPath] = useState("");
  const [rootNodes, setRootNodes] = useState<ModelNode[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, ModelNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [rootLoading, setRootLoading] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ path: string; isDir: boolean } | null>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  const reportError = useCallback(
    (err: unknown) => onError?.(err instanceof Error ? err.message : String(err)),
    [onError],
  );

  const loadRoot = useCallback(async () => {
    setRootLoading(true);
    try {
      const data = await fetchModelTree({ path: rootPath || undefined, depth: 1 });
      setRootNodes(data.tree);
      setChildrenByPath({});
    } catch (err) {
      reportError(err);
    } finally {
      setRootLoading(false);
    }
  }, [reportError, rootPath]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot, refreshVersion]);

  const loadChildren = useCallback(
    async (path: string) => {
      setLoadingPaths((prev) => new Set(prev).add(path));
      try {
        const data = await fetchModelTree({ path, depth: 1 });
        setChildrenByPath((prev) => ({ ...prev, [path]: data.tree }));
      } catch (err) {
        reportError(err);
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [reportError],
  );

  /** Refetch the folder that owns `childPath` (root list if it's the tree root). */
  const reloadParent = useCallback(
    async (childPath: string) => {
      const parent = parentOf(childPath);
      if (parent === rootPath) {
        await loadRoot();
      } else {
        await loadChildren(parent);
      }
    },
    [loadChildren, loadRoot, rootPath],
  );

  const toggleDir = useCallback(
    (node: ModelNode) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
          if (!childrenByPath[node.path] && !node.children) void loadChildren(node.path);
        }
        return next;
      });
    },
    [childrenByPath, loadChildren],
  );

  // Auto-expand the branch down to the active file and scroll it into view.
  useEffect(() => {
    if (!activeFile) return;
    if (rootPath && !(activeFile === rootPath || activeFile.startsWith(`${rootPath}/`))) return;
    const parts = activeFile.split("/");
    const ancestors: string[] = [];
    let acc = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      if (!rootPath || acc === rootPath || acc.startsWith(`${rootPath}/`)) ancestors.push(acc);
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const dir of ancestors) next.add(dir);
      return next;
    });
    for (const dir of ancestors) {
      if (dir !== rootPath && !childrenByPath[dir]) void loadChildren(dir);
    }
    const timer = window.setTimeout(() => {
      activeRowRef.current?.scrollIntoView({ block: "nearest" });
    }, 60);
    return () => window.clearTimeout(timer);
    // childrenByPath intentionally omitted: only re-run when the active file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, rootPath, loadChildren]);

  const openContextMenu = (event: React.MouseEvent, target: ContextTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, target });
  };

  const submitPrompt = async (name: string) => {
    const state = prompt;
    setPrompt(null);
    if (!state) return;
    try {
      if (state.mode === "rename") {
        const parent = parentOf(state.path);
        const to = parent ? `${parent}/${name}` : name;
        if (to === state.path) return;
        await moveNode(state.path, to);
        await reloadParent(to);
        onPathChange?.(state.path, to);
      } else if (state.mode === "newFile") {
        const path = state.parent ? `${state.parent}/${name}` : name;
        await createFile(path);
        await reloadParent(path);
        if (state.parent) setExpanded((prev) => new Set(prev).add(state.parent));
        onOpenFile(path);
      } else {
        const res = await createFolder(state.parent, name);
        await reloadParent(res.path);
        setExpanded((prev) => new Set(prev).add(res.path));
        if (state.parent) setExpanded((prev) => new Set(prev).add(state.parent));
      }
    } catch (err) {
      reportError(err);
    }
  };

  const runDelete = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    if (!target) return;
    try {
      await deleteNode(target.path, target.isDir);
      await reloadParent(target.path);
      onPathChange?.(target.path, null);
    } catch (err) {
      reportError(err);
    }
  };

  const renderNode = (node: ModelNode, depth: number): React.ReactNode => {
    const indentStyle = { paddingLeft: `${depth * 12 + 8}px` };
    if (node.type === "directory") {
      const isOpen = expanded.has(node.path);
      const kids = childrenByPath[node.path] ?? node.children ?? [];
      const isLoading = loadingPaths.has(node.path);
      return (
        <div key={node.path}>
          <button
            type="button"
            style={indentStyle}
            onClick={() => toggleDir(node)}
            onContextMenu={(event) => openContextMenu(event, { path: node.path, isDir: true })}
            className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs text-foreground hover:bg-accent/50"
          >
            {isOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isOpen ? (
            isLoading && kids.length === 0 ? (
              <div
                style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
                className="py-0.5 text-[11px] text-muted-foreground"
              >
                Loading…
              </div>
            ) : (
              kids.map((child) => renderNode(child, depth + 1))
            )
          ) : null}
        </div>
      );
    }

    const active = node.path === activeFile;
    return (
      <button
        key={node.path}
        ref={active ? activeRowRef : undefined}
        type="button"
        style={indentStyle}
        title={node.path}
        onClick={() => onOpenFile(node.path)}
        onContextMenu={(event) => openContextMenu(event, { path: node.path, isDir: false })}
        className={cn(
          "flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs hover:bg-accent/50",
          active ? "bg-accent text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="w-3 shrink-0" aria-hidden="true" />
        <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      onContextMenu={(event) => {
        // Right-click on empty tree space targets the current root.
        if (event.target === event.currentTarget) openContextMenu(event, null);
      }}
    >
      <div className="flex h-[var(--workspace-pane-header-height,2.25rem)] shrink-0 items-center justify-between border-b border-border px-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {rootPath ? basename(rootPath) : "Explorer"}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            label="New file"
            onClick={() => setPrompt({ mode: "newFile", parent: rootPath })}
          >
            <FilePlus className="h-3 w-3" aria-hidden="true" />
          </IconBtn>
          <IconBtn
            label="New folder"
            onClick={() => setPrompt({ mode: "newFolder", parent: rootPath })}
          >
            <FolderPlus className="h-3 w-3" aria-hidden="true" />
          </IconBtn>
          <IconBtn label="Reload file tree" onClick={() => void loadRoot()}>
            <RefreshCw className={cn("h-3 w-3", rootLoading && "animate-spin")} aria-hidden="true" />
          </IconBtn>
        </div>
      </div>

      {rootPath ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
          <IconBtn label="Back to project root" onClick={() => setRootPath("")}>
            <Home className="h-3 w-3" aria-hidden="true" />
          </IconBtn>
          {parentOf(rootPath) !== rootPath ? (
            <IconBtn label="Up one folder" onClick={() => setRootPath(parentOf(rootPath))}>
              <ChevronRight className="h-3 w-3 rotate-180" aria-hidden="true" />
            </IconBtn>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={rootPath}>
            {rootPath}
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {rootLoading && rootNodes.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
        ) : rootNodes.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Empty folder.</div>
        ) : (
          rootNodes.map((node) => renderNode(node, 0))
        )}
      </div>

      {menu
        ? createPortal(
            <ContextMenu
              x={menu.x}
              y={menu.y}
              target={menu.target}
              onClose={() => setMenu(null)}
              onNewFile={(parent) => setPrompt({ mode: "newFile", parent })}
              onNewFolder={(parent) => setPrompt({ mode: "newFolder", parent })}
              onRename={(path, isDir) =>
                setPrompt({ mode: "rename", path, isDir, current: basename(path) })
              }
              onDelete={(path, isDir) => setConfirmDelete({ path, isDir })}
              onOpenAsRoot={(path) => setRootPath(path)}
            />,
            document.body,
          )
        : null}

      {prompt ? (
        <NameDialog
          title={
            prompt.mode === "newFile"
              ? "New file"
              : prompt.mode === "newFolder"
                ? "New folder"
                : "Rename"
          }
          label={prompt.mode === "newFile" ? "File name (with extension)" : "Name"}
          defaultValue={prompt.mode === "rename" ? prompt.current : ""}
          confirmLabel={prompt.mode === "rename" ? "Rename" : "Create"}
          onConfirm={(name) => void submitPrompt(name)}
          onCancel={() => setPrompt(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.isDir ? "Delete folder" : "Delete file"}
        message={
          confirmDelete
            ? `Delete "${confirmDelete.path}"${confirmDelete.isDir ? " and everything inside it" : ""}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void runDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </button>
  );
}

function ContextMenu({
  x,
  y,
  target,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onOpenAsRoot,
}: {
  x: number;
  y: number;
  target: ContextTarget;
  onClose: () => void;
  onNewFile: (parent: string) => void;
  onNewFolder: (parent: string) => void;
  onRename: (path: string, isDir: boolean) => void;
  onDelete: (path: string, isDir: boolean) => void;
  onOpenAsRoot: (path: string) => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // For a file target, "new" applies to its parent folder.
  const newParent = target ? (target.isDir ? target.path : parentOf(target.path)) : "";
  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - 200);

  return (
    <div
      role="menu"
      className="fixed z-[90] min-w-[10rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MenuItem
        icon={<FilePlus className="h-3.5 w-3.5" />}
        label="New file"
        onClick={() => {
          onNewFile(newParent);
          onClose();
        }}
      />
      <MenuItem
        icon={<FolderPlus className="h-3.5 w-3.5" />}
        label="New folder"
        onClick={() => {
          onNewFolder(newParent);
          onClose();
        }}
      />
      {target ? (
        <>
          {target.isDir ? (
            <MenuItem
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              label="Open as root"
              onClick={() => {
                onOpenAsRoot(target.path);
                onClose();
              }}
            />
          ) : null}
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icon={<Pencil className="h-3.5 w-3.5" />}
            label="Rename"
            onClick={() => {
              onRename(target.path, target.isDir);
              onClose();
            }}
          />
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Delete"
            destructive
            onClick={() => {
              onDelete(target.path, target.isDir);
              onClose();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground",
        destructive && "text-destructive",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Permissive name prompt (allows dots/extensions, unlike the node NamePromptDialog). */
function NameDialog({
  title,
  label,
  defaultValue,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  defaultValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return setError("Name is required");
    if (trimmed.includes("/") || trimmed === "." || trimmed === "..") {
      return setError("Invalid name");
    }
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <label className="mt-3 block text-xs text-muted-foreground">{label}</label>
        <input
          ref={inputRef}
          className={cn(
            "mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none ring-primary focus:ring-1",
            error ? "border-destructive" : "border-border",
          )}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
