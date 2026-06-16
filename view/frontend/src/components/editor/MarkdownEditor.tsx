import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileCode2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { cn } from "@/lib/utils";
import { getUserName } from "@/lib/userIdentity";
import { parseFrontmatterStatus, parentPath, stripFrontmatter, type NavigateTarget } from "@/lib/modelTree";
import {
  ApiError,
  claimPresence,
  fetchPresence,
  heartbeatPresence,
  releasePresence,
} from "@/modelApi";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
export type EditorLayout = "split" | "source" | "preview";
export type PaneEditMode = "rendered" | "raw";

function parsePreviewBody(markdown: string) {
  const withoutFrontmatter = stripFrontmatter(markdown);
  const headingMatch = withoutFrontmatter.match(/^\s*#(?!#)\s+(.+?)\s*(?:\r?\n|$)/);
  if (!headingMatch) {
    return { title: null, body: withoutFrontmatter };
  }
  return {
    title: headingMatch[1],
    body: withoutFrontmatter.slice(headingMatch[0].length),
  };
}

function splitForPreviewEdit(full: string) {
  const fmMatch = full.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) {
    return { frontmatter: "", body: full, suffix: "" };
  }
  const frontmatter = fmMatch[0];
  const rest = full.slice(frontmatter.length);
  return { frontmatter, body: rest, suffix: "" };
}

function mergePreviewEdit(frontmatter: string, body: string): string {
  return frontmatter ? `${frontmatter}${body}` : body;
}

export function MarkdownEditor({
  filePath,
  refreshVersion,
  layout,
  compact = false,
  paneLabel,
  defaultPaneMode = "rendered",
  onSaveStateChange,
  onError,
  className,
  linkContextPath = "",
  onNavigate,
}: {
  filePath: string;
  refreshVersion: number;
  layout: EditorLayout;
  compact?: boolean;
  paneLabel?: string;
  defaultPaneMode?: PaneEditMode;
  onSaveStateChange?: (state: SaveState) => void;
  onError?: (message: string) => void;
  className?: string;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
}) {
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paneMode, setPaneMode] = useState<PaneEditMode>(defaultPaneMode);
  const [previewRawEdit, setPreviewRawEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState(1);
  const [otherEditor, setOtherEditor] = useState<string | null>(null);
  const authorName = useMemo(() => getUserName(), []);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty = content !== loadedContent;
  const previewParts = useMemo(() => splitForPreviewEdit(content), [content]);
  const previewMeta = useMemo(() => parsePreviewBody(content), [content]);
  /** Body for preview panes — H1 is shown separately, so omit it from markdown render/edit. */
  const previewBody = previewMeta.title ? previewMeta.body : previewParts.body;
  const unitStatus = useMemo(() => parseFrontmatterStatus(content), [content]);

  useEffect(() => {
    setPreviewRawEdit(false);
    setPaneMode(defaultPaneMode);
  }, [defaultPaneMode, filePath, refreshVersion]);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    const controller = new AbortController();
    if (content !== loadedContent) {
      return () => controller.abort();
    }

    fetch(`${apiBaseUrl}/api/model/file?path=${encodeURIComponent(filePath)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setContent("");
          setLoadedContent("");
          setSaveState("idle");
          setLoadError(null);
          return;
        }
        if (!response.ok) throw new Error(`Failed to load ${filePath}`);
        return (await response.json()) as { content: string };
      })
      .then((data) => {
        if (!data) return;
        setContent(data.content);
        setLoadedContent(data.content);
        setSaveState("idle");
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message);
          setSaveState("error");
          onError?.(message);
        }
      });

    return () => controller.abort();
  }, [content, filePath, loadedContent, onError, refreshVersion]);

  useEffect(() => {
    if (!isDirty) return;
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const nextContent = content;
      try {
        const response = await fetch(`${apiBaseUrl}/api/model/file`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content: nextContent }),
        });
        if (response.status === 404) {
          const createRes = await fetch(`${apiBaseUrl}/api/model/file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath, content: nextContent }),
          });
          if (!createRes.ok) throw new Error(`Failed to save ${filePath}`);
        } else if (!response.ok) {
          throw new Error(`Failed to save ${filePath}`);
        }
        setLoadedContent(nextContent);
        setSaveState("saved");
        setLoadError(null);
        window.setTimeout(() => setSaveState("idle"), 900);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveState("error");
        setLoadError(message);
        onError?.(message);
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [content, filePath, isDirty, onError]);

  useEffect(() => {
    let cancelled = false;
    let heartbeatTimer: number | undefined;

    const syncPresence = async () => {
      try {
        const { presence } = await fetchPresence(filePath);
        if (cancelled) return;
        if (presence && presence.user !== authorName) {
          setOtherEditor(presence.user);
          return;
        }
        try {
          await claimPresence(filePath, authorName);
          if (!cancelled) setOtherEditor(null);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            const retry = await fetchPresence(filePath);
            if (!cancelled && retry.presence) setOtherEditor(retry.presence.user);
          }
        }
      } catch {
        // presence is best-effort on localhost
      }
    };

    void syncPresence();
    heartbeatTimer = window.setInterval(() => {
      void heartbeatPresence(filePath, authorName);
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      void releasePresence(filePath, authorName);
    };
  }, [authorName, filePath]);

  const updateSelectedLine = () => {
    const el = sourceRef.current ?? previewRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    setSelectedLine(before.split("\n").length);
  };

  const effectiveLayout = compact ? (paneMode === "raw" ? "source" : "preview") : layout;
  const showSource = effectiveLayout === "source" || effectiveLayout === "split";
  const showPreview = effectiveLayout === "preview" || effectiveLayout === "split";
  const renderedEditable = compact ? paneMode === "rendered" : previewRawEdit;

  const handlePreviewBodyChange = (body: string) => {
    const withHeading = previewMeta.title ? `# ${previewMeta.title}\n\n${body.replace(/^\s+/, "")}` : body;
    setContent(mergePreviewEdit(previewParts.frontmatter, withHeading));
  };

  const modeToggle = compact ? (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="group"
      aria-label={`${paneLabel ?? "Document"} editing mode`}
    >
      <Button
        type="button"
        variant={paneMode === "rendered" ? "default" : "ghost"}
        size="sm"
        className="h-6 gap-1 px-2 text-[10px]"
        aria-pressed={paneMode === "rendered"}
        title="Rendered editing"
        onClick={() => setPaneMode("rendered")}
      >
        <Eye className="h-3 w-3" aria-hidden="true" />
        Rendered
      </Button>
      <Button
        type="button"
        variant={paneMode === "raw" ? "default" : "ghost"}
        size="sm"
        className="h-6 gap-1 px-2 text-[10px]"
        aria-pressed={paneMode === "raw"}
        title="Raw markdown"
        onClick={() => setPaneMode("raw")}
      >
        <FileCode2 className="h-3 w-3" aria-hidden="true" />
        Raw
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      variant={previewRawEdit ? "default" : "ghost"}
      size="icon"
      className="h-6 w-6"
      title={previewRawEdit ? "Show rendered preview" : "Edit in rendered style"}
      aria-label={previewRawEdit ? "Show rendered preview" : "Edit in rendered style"}
      aria-pressed={previewRawEdit}
      onClick={() => setPreviewRawEdit((v) => !v)}
    >
      {previewRawEdit ? (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );

  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {otherEditor ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100">
          Being edited by {otherEditor}
        </div>
      ) : null}
      {loadError ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {loadError}
        </div>
      ) : null}

      {compact ? (
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-[hsl(var(--reading-bg))] px-3">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {paneLabel ?? "Document"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {isDirty ? "unsaved" : saveState}
              {unitStatus ? ` · ${unitStatus}` : ""}
            </span>
            <Button
              type="button"
              variant={commentsOpen ? "default" : "ghost"}
              size="icon"
              className="h-6 w-6"
              title="Comments"
              aria-label="Toggle comments"
              aria-pressed={commentsOpen}
              onClick={() => setCommentsOpen((open) => !open)}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            {modeToggle}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "editor-panes grid min-h-0 flex-1",
          effectiveLayout === "split" ? "editor-panes-split" : "grid-cols-1",
        )}
      >
        {showSource ? (
          <div className="flex min-h-0 flex-col bg-[hsl(var(--editor-bg))]">
            {!compact ? (
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Source
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {isDirty ? "unsaved" : saveState}
                    {unitStatus ? ` · ${unitStatus}` : ""}
                  </span>
                  <Button
                    type="button"
                    variant={commentsOpen ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    title="Comments"
                    aria-label="Toggle comments"
                    aria-pressed={commentsOpen}
                    onClick={() => setCommentsOpen((open) => !open)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}
            <textarea
              ref={sourceRef}
              className="min-h-0 flex-1 resize-none overflow-auto border-0 bg-transparent p-4 font-mono text-[13px] leading-6 outline-none focus:ring-0"
              value={content}
              spellCheck={false}
              aria-label={`Edit source ${filePath}`}
              onChange={(e) => setContent(e.target.value)}
              onSelect={updateSelectedLine}
              onKeyUp={updateSelectedLine}
              onClick={updateSelectedLine}
            />
          </div>
        ) : null}

        {showPreview ? (
          <div className="flex min-h-0 flex-col bg-[hsl(var(--reading-bg))]">
            {!compact ? (
              <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
                <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Preview
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    {isDirty ? "unsaved" : saveState}
                  </span>
                  <Button
                    type="button"
                    variant={commentsOpen ? "default" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    title="Comments"
                    aria-label="Toggle comments"
                    aria-pressed={commentsOpen}
                    onClick={() => setCommentsOpen((open) => !open)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  {modeToggle}
                </div>
              </div>
            ) : null}
            <div className={cn("markdown-preview-edit min-h-0 flex-1 overflow-auto px-6 py-5", compact && "markdown-pane")}>
              {renderedEditable ? (
                <div className="space-y-4">
                  {previewMeta.title ? (
                    <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                      {previewMeta.title}
                    </h1>
                  ) : null}
                  {previewBody.trim() ? (
                    <MarkdownViewer markdown={previewBody} className="pointer-events-none select-none opacity-95" />
                  ) : null}
                  <textarea
                    ref={previewRef}
                    className="markdown-reading markdown-reading-edit w-full min-h-[10rem] resize-none border-0 border-t border-border/40 bg-transparent p-0 pt-4 outline-none focus:ring-0"
                    value={previewBody}
                    spellCheck={true}
                    aria-label={`Edit ${paneLabel ?? "document"} ${filePath}`}
                    placeholder="Write here…"
                    onChange={(e) => handlePreviewBodyChange(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  {previewMeta.title ? (
                    <h1 className="mb-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
                      {previewMeta.title}
                    </h1>
                  ) : null}
                  {previewBody.trim() ? (
                    <MarkdownViewer
                      markdown={previewBody}
                      linkContextPath={linkContextPath || parentPath(filePath)}
                      linksClickable={Boolean(onNavigate)}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <p className="text-sm italic text-muted-foreground">Empty document.</p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
      </div>
      {commentsOpen ? (
        <CommentsPanel
          filePath={filePath}
          authorName={authorName}
          refreshVersion={refreshVersion}
          selectedLine={selectedLine}
          onError={onError}
          onClose={() => setCommentsOpen(false)}
        />
      ) : null}
    </div>
  );
}
