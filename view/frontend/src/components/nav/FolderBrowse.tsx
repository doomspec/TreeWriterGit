import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Lightbulb,
  Pencil,
  Trash2,
} from "lucide-react";

import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, NamePromptDialog } from "@/components/ui/NamePromptDialog";
import { getDefaultAgentProvider, rememberAgentProvider } from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";
import { ApiError, deleteNode, moveNode, reorderChildren } from "@/modelApi";
import {
  childCardsForFolder,
  indexPathFor,
  isIndexStale,
  isUnitFolder,
  findNode,
  outlinePathFor,
  parseIndexFrontmatter,
  parseIndexOutline,
  parseOutlineSummary,
  stripFrontmatter,
  type ModelNode,
  type NavigateTarget,
  type OutlineItem,
} from "@/lib/modelTree";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function fetchModelFile(pathValue: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(pathValue)}`);
  if (response.status === 404) return "";
  if (!response.ok) throw new Error(`Failed to load ${pathValue}`);
  const data = (await response.json()) as { content: string };
  return data.content;
}

export function FolderBrowse({
  tree,
  currentPath,
  onOpenFolder,
  onOpenFile,
  onChanged,
  onError,
  onSendToTerminal,
  onNavigate,
}: {
  tree: ModelNode[];
  currentPath: string;
  onOpenFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onSendToTerminal?: (command: string) => void;
  onNavigate?: (target: NavigateTarget) => void;
}) {
  const [indexContent, setIndexContent] = useState("");
  const [outlineContent, setOutlineContent] = useState("");
  const [childSummaries, setChildSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [renameItem, setRenameItem] = useState<OutlineItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<OutlineItem | null>(null);
  const [recursiveDelete, setRecursiveDelete] = useState<OutlineItem | null>(null);

  const indexPath = indexPathFor(currentPath);
  const outlinePath = outlinePathFor(currentPath);
  const meta = useMemo(() => parseIndexFrontmatter(indexContent), [indexContent]);
  const outlineLinks = useMemo(
    () => parseIndexOutline(outlineContent || indexContent, currentPath),
    [outlineContent, indexContent, currentPath],
  );
  const childCards = useMemo(
    () => childCardsForFolder(tree, currentPath, meta.childOrder),
    [tree, currentPath, meta.childOrder],
  );
  const stale = isIndexStale(meta.composedAtCommit);
  const bodySummary = useMemo(() => {
    if (meta.summary) return meta.summary;
    return parseOutlineSummary(outlineContent || indexContent);
  }, [indexContent, meta.summary, outlineContent]);
  const indexBodyMarkdown = useMemo(() => {
    if (bodySummary) return "";
    const withoutFm = stripFrontmatter(outlineContent || indexContent);
    return withoutFm.replace(/^\s*#(?!#)\s+[^\n\r]+\r?\n?/, "").trim();
  }, [bodySummary, indexContent, outlineContent]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchModelFile(indexPath), fetchModelFile(outlinePath)])
      .then(([index, outline]) => {
        if (!cancelled) {
          setIndexContent(index);
          setOutlineContent(outline);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIndexContent("");
          setOutlineContent("");
          setLoading(false);
          onError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [indexPath, outlinePath, onError]);

  useEffect(() => {
    let cancelled = false;
    const dirs = childCards.filter((c) => c.kind === "directory");
    if (dirs.length === 0) {
      setChildSummaries({});
      return;
    }
    Promise.all(
      dirs.map(async (item) => {
        const outline = await fetchModelFile(outlinePathFor(item.path));
        return [item.path, parseOutlineSummary(outline) ?? ""] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setChildSummaries(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (!cancelled) setChildSummaries({});
      });
    return () => {
      cancelled = true;
    };
  }, [childCards]);

  const runDelete = async (item: OutlineItem, recursive: boolean) => {
    try {
      await deleteNode(item.path, recursive);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    const item = deleteItem;
    setDeleteItem(null);
    try {
      await deleteNode(item.path);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRecursiveDelete(item);
        return;
      }
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const submitRename = async (nextName: string) => {
    if (!renameItem) return;
    const item = renameItem;
    setRenameItem(null);
    const nodePath = item.path;
    const current = nodePath.split("/").at(-1) ?? "";
    const baseCurrent = current.replace(/\.md$/, "");
    if (nextName === baseCurrent) return;
    const parent = nodePath.split("/").slice(0, -1).join("/");
    const fileName =
      item.kind === "file" && !nextName.endsWith(".md") ? `${nextName}.md` : nextName;
    const to = parent ? `${parent}/${fileName}` : fileName;
    try {
      await moveNode(nodePath, to);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = (item: OutlineItem) => {
    setDeleteItem(item);
  };

  const handleRename = (item: OutlineItem) => {
    setRenameItem(item);
  };

  const moveChild = async (index: number, direction: -1 | 1) => {
    const names = childCards
      .filter((c) => c.kind === "directory")
      .map((c) => c.name);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= names.length) return;
    const order = [...names];
    [order[index], order[newIndex]] = [order[newIndex], order[index]];
    try {
      await reorderChildren(currentPath, order);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const openItem = (item: OutlineItem) => {
    if (item.kind === "directory") {
      const node = findNode(tree, item.path);
      if (isUnitFolder(node)) {
        onOpenFile(outlinePathFor(item.path));
      } else {
        onOpenFolder(item.path);
      }
      return;
    }
    onOpenFile(item.path);
  };

  const openOutlineLink = (targetPath: string | null, href: string) => {
    if (!targetPath) return;
    if (onNavigate) {
      if (targetPath.endsWith(".md") && !targetPath.endsWith("/INDEX.md") && !targetPath.endsWith("/outline.md")) {
        onNavigate({ type: "file", path: targetPath });
        return;
      }
      const folder = targetPath.replace(/\/?INDEX\.md$/, "");
      onNavigate({ type: "folder", path: folder });
      return;
    }
    if (targetPath.endsWith(".md") && !targetPath.endsWith("/INDEX.md") && !targetPath.endsWith("/outline.md")) {
      onOpenFile(targetPath);
      return;
    }
    const folder = targetPath.replace(/\/?INDEX\.md$/, "");
    onOpenFolder(folder);
  };

  const handleRefreshIndex = async () => {
    if (!onSendToTerminal) return;
    try {
      const provider = await getDefaultAgentProvider();
      const res = await fetch(`${apiBaseUrl}/api/agent/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPath: currentPath,
          action: "refresh-index",
          provider,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Refresh preview failed (${res.status})`);
      }
      const data = (await res.json()) as { command: string };
      rememberAgentProvider(provider);
      onSendToTerminal(`${data.command}\n`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-workspace">
      <article className="border-b border-border bg-card p-5 shadow-sm">
        <div className="mb-2 flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {meta.title ?? currentPath.split("/").pop() ?? "model"}
              </h2>
              {stale ? (
                <span className="ui-badge-warning">Outline may be stale</span>
              ) : null}
              {meta.kind ? (
                <span className="ui-badge-neutral">{meta.kind}</span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Edit outline"
            aria-label="Edit outline"
            onClick={() => onOpenFile(outlinePath)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {onSendToTerminal ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 shrink-0 px-2 text-[11px]"
              title="Regenerate outline from children via AI"
              onClick={() => void handleRefreshIndex()}
            >
              Refresh outline
            </Button>
          ) : null}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading outline…</p>
        ) : bodySummary ? (
          <MarkdownViewer
            markdown={bodySummary}
            className="mt-3"
            linkContextPath={currentPath}
            linksClickable={Boolean(onNavigate)}
            onNavigate={onNavigate}
          />
        ) : indexBodyMarkdown ? (
          <MarkdownViewer
            markdown={indexBodyMarkdown}
            className="mt-3"
            linkContextPath={currentPath}
            linksClickable={Boolean(onNavigate)}
            onNavigate={onNavigate}
          />
        ) : null}
        {outlineLinks.length > 0 ? (
          <div className="mt-4">
            <h3 className="ui-label mb-2">Outline</h3>
            <ul className="flex flex-wrap gap-2">
              {outlineLinks.map((link) => (
                <li key={`${link.label}:${link.href}`}>
                  <button
                    type="button"
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-primary hover:bg-accent"
                    onClick={() => openOutlineLink(link.targetPath, link.href)}
                  >
                    {link.label}
                    {link.isFigure ? (
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                        Fig
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {childCards.map((item, index) => {
          const Icon = item.kind === "directory" ? Folder : FileText;
          const dirIndex = childCards
            .slice(0, index + 1)
            .filter((c) => c.kind === "directory").length - 1;
          const isDir = item.kind === "directory";

          return (
            <article
              key={item.id}
              className="group flex flex-col rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                className="flex min-h-[88px] flex-1 flex-col p-4 text-left"
                onClick={() => openItem(item)}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate font-medium">{item.name.replace(/\.md$/, "")}</span>
                </div>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{item.subtitle}</span>
                {item.kind === "directory" && childSummaries[item.path] ? (
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {childSummaries[item.path]}
                  </p>
                ) : null}
              </button>
              <div className="flex items-center justify-end gap-1 border-t border-border px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {isDir ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Move up"
                      disabled={dirIndex <= 0}
                      onClick={() => void moveChild(dirIndex, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Move down"
                      disabled={dirIndex >= childCards.filter((c) => c.kind === "directory").length - 1}
                      onClick={() => void moveChild(dirIndex, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Rename"
                  onClick={() => handleRename(item)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", item.kind !== "index" && "")}
                  title="Delete"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <NamePromptDialog
        open={renameItem !== null}
        title="Rename"
        label="New name"
        defaultValue={renameItem?.path.split("/").at(-1)?.replace(/\.md$/, "") ?? ""}
        confirmLabel="Rename"
        onConfirm={(name) => void submitRename(name)}
        onCancel={() => setRenameItem(null)}
      />
      <ConfirmDialog
        open={deleteItem !== null}
        title="Delete"
        message={deleteItem ? `Delete ${deleteItem.path}?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteItem(null)}
      />
      <ConfirmDialog
        open={recursiveDelete !== null}
        title="Delete recursively"
        message={recursiveDelete ? `${recursiveDelete.path} is not empty. Delete all contents?` : ""}
        confirmLabel="Delete all"
        destructive
        onConfirm={() => {
          const item = recursiveDelete;
          setRecursiveDelete(null);
          if (item) void runDelete(item, true);
        }}
        onCancel={() => setRecursiveDelete(null)}
      />
    </div>
  );
}
