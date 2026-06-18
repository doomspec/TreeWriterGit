import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Eye, FileCode2 } from "lucide-react";

import { RenderedMarkdownField } from "@/components/editor/RenderedMarkdownField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncSectionDraft } from "@/modelApi";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type PaneEditMode = "rendered" | "raw";

function parseLinkedHeadings(
  markdown: string,
): Array<{ title: string; href: string; depth: number }> {
  const items: Array<{ title: string; href: string; depth: number }> = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{2,4})\s+\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      items.push({
        depth: match[1].length,
        title: match[2].trim(),
        href: match[3].trim(),
      });
    }
  }
  return items;
}

export type ComposedDraftChild = {
  path: string;
  title: string;
  kind: "unit" | "section" | "figure" | "table";
};

export function ComposedDraftEditor({
  containerPath,
  title,
  markdown,
  refreshVersion,
  linkContextPath,
  children,
  onNavigate,
  onError,
  onSynced,
  paneLabel = "Draft",
  subtitle,
  headerExtra,
  className,
}: {
  containerPath: string;
  title: string;
  markdown: string;
  refreshVersion: number;
  linkContextPath: string;
  children: ComposedDraftChild[];
  onNavigate: (target: NavigateTarget) => void;
  onError: (message: string) => void;
  onSynced?: () => void;
  paneLabel?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  className?: string;
}) {
  const [content, setContent] = useState(markdown);
  const [loadedContent, setLoadedContent] = useState(markdown);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [paneMode, setPaneMode] = useState<PaneEditMode>("rendered");
  const [navOpen, setNavOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirtyRef = useRef(false);
  const isDirty = content !== loadedContent;
  isDirtyRef.current = isDirty;
  const linkedHeadings = parseLinkedHeadings(content);
  const lineCount = useMemo(() => Math.max(24, content.split("\n").length + 2), [content]);

  useEffect(() => {
    if (isDirtyRef.current) return;
    setContent(markdown);
    setLoadedContent(markdown);
    setSaveState("idle");
  }, [markdown, refreshVersion]);

  useEffect(() => {
    if (!isDirty) return;
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const draftMarkdown = title.trim()
        ? `# ${title.trim()}\n\n${content.trimEnd()}\n`
        : `${content.trimEnd()}\n`;
      try {
        await syncSectionDraft(containerPath, draftMarkdown);
        setLoadedContent(content);
        setSaveState("saved");
        onSynced?.();
        window.setTimeout(() => setSaveState("idle"), 900);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveState("error");
        onError(message);
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [containerPath, content, isDirty, onError, onSynced, title]);

  const handleChildNavigate = useCallback(
    (childPath: string) => {
      onNavigate({ type: "folder", path: childPath });
    },
    [onNavigate],
  );

  const handleHeadingNavigate = useCallback(
    (href: string) => {
      const target = resolveNavigateTarget(linkContextPath, href);
      if (target) onNavigate(target);
    },
    [linkContextPath, onNavigate],
  );

  const handleRawClick = useCallback(
    (event: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const textarea = event.currentTarget;
      const lineIndex = textarea.value.slice(0, textarea.selectionStart).split("\n").length - 1;
      const line = textarea.value.split("\n")[lineIndex] ?? "";
      const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!match) return;
      event.preventDefault();
      handleHeadingNavigate(match[2]);
    },
    [handleHeadingNavigate],
  );

  const saveLabel =
    saveState === "dirty"
      ? "unsaved"
      : saveState === "saving"
        ? "syncing…"
        : saveState === "saved"
          ? "synced to sections"
          : saveState === "error"
            ? "sync error"
            : "autosync";

  const navItems = useMemo(() => {
    if (linkedHeadings.length > 0) {
      return linkedHeadings.map((heading, index) => ({
        key: `${heading.href}-${index}`,
        title: heading.title,
        href: heading.href,
        depth: heading.depth,
      }));
    }
    return children.map((child) => ({
      key: child.path,
      title: child.title,
      href: "",
      depth: 2,
      path: child.path,
    }));
  }, [children, linkedHeadings]);

  const showNav = navItems.length > 0;
  const navCollapsed = navItems.length > 6 && !navOpen;

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="ui-pane-header shrink-0">
        <div className="flex min-w-0 flex-col">
          <span className="ui-label">{paneLabel}</span>
          {subtitle ? (
            <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-ui-2xs text-muted-foreground">{saveLabel}</span>
          {headerExtra}
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="group"
            aria-label={`${paneLabel} editing mode`}
          >
            <Button
              type="button"
              variant={paneMode === "rendered" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              aria-pressed={paneMode === "rendered"}
              title="Preview + edit — live formatted view above source"
              onClick={() => setPaneMode("rendered")}
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              Preview
            </Button>
            <Button
              type="button"
              variant={paneMode === "raw" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              aria-pressed={paneMode === "raw"}
              title="Raw markdown with section links"
              onClick={() => setPaneMode("raw")}
            >
              <FileCode2 className="h-3 w-3" aria-hidden="true" />
              Raw
            </Button>
          </div>
        </div>
      </div>

      {showNav ? (
        <div className="shrink-0 border-b border-border bg-muted/20 px-3 py-2">
          <button
            type="button"
            className="flex w-full items-center gap-1 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navCollapsed ? (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
            Jump to section ({navItems.length})
          </button>
          {!navCollapsed ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-primary hover:bg-accent/50"
                  style={{
                    marginLeft: item.depth > 2 ? `${(item.depth - 2) * 0.5}rem` : undefined,
                  }}
                  onClick={() =>
                    "path" in item && typeof item.path === "string"
                      ? handleChildNavigate(item.path)
                      : handleHeadingNavigate(item.href)
                  }
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="markdown-pane min-h-0 flex-1 overflow-auto px-6 py-5">
        {content.trim() || paneMode === "raw" ? (
          paneMode === "rendered" ? (
            <RenderedMarkdownField
              value={content}
              onChange={setContent}
              linkContextPath={linkContextPath}
              linksClickable
              onNavigate={onNavigate}
              inputRef={textareaRef}
              ariaLabel={`Edit composed ${paneLabel.toLowerCase()}`}
              placeholder="Full composed draft — edit here; changes sync to section drafts automatically…"
            />
          ) : (
            <textarea
              ref={textareaRef}
              className="composed-draft-raw w-full resize-none border-0 bg-transparent font-mono text-[13px] leading-6 outline-none focus:ring-0"
              value={content}
              rows={lineCount}
              spellCheck={false}
              aria-label={`Edit raw composed ${paneLabel.toLowerCase()}`}
              onChange={(event) => setContent(event.target.value)}
              onClick={handleRawClick}
            />
          )
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No draft content yet — start writing here; changes sync to child section drafts
            automatically.
          </p>
        )}
      </div>
    </div>
  );
}
