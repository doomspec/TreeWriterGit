import { useCallback, useEffect, useState } from "react";
import { Check, MessageSquare, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
  type CommentRecord,
} from "@/modelApi";

export function CommentsPanel({
  filePath,
  authorName,
  refreshVersion,
  selectedLine = 1,
  onError,
  onClose,
}: {
  filePath: string;
  authorName: string;
  refreshVersion: number;
  selectedLine?: number;
  onError?: (message: string) => void;
  onClose?: () => void;
}) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [line, setLine] = useState(selectedLine);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { comments: next } = await fetchComments(filePath);
      setComments(next);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filePath, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshVersion]);

  useEffect(() => {
    setLine(selectedLine);
  }, [selectedLine]);

  const unresolved = comments.filter((c) => !c.resolved).length;

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await createComment({ path: filePath, line, author: authorName, text: draft.trim() });
      setDraft("");
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleResolved = async (comment: CommentRecord) => {
    try {
      await updateComment(comment.id, {
        path: filePath,
        resolved: !comment.resolved,
      });
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (comment: CommentRecord) => {
    try {
      await deleteComment(comment.id, filePath);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Comments
          {unresolved > 0 ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {unresolved}
            </span>
          ) : null}
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "rounded-md border border-border/80 px-2.5 py-2 text-xs",
                comment.resolved && "opacity-60",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{comment.author}</span>
                <span className="text-[10px] text-muted-foreground">L{comment.line}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{comment.text}</p>
              <div className="mt-2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  onClick={() => void toggleResolved(comment)}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {comment.resolved ? "Reopen" : "Resolve"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px] text-destructive"
                  onClick={() => void handleDelete(comment)}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          Line
          <input
            type="number"
            min={1}
            className="h-6 w-16 rounded border border-border bg-background px-1.5 text-xs"
            value={line}
            onChange={(e) => setLine(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <textarea
          className="h-16 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none ring-primary focus:ring-1"
          placeholder="Add a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          className="h-7 w-full text-xs"
          disabled={submitting || !draft.trim()}
          onClick={() => void handleSubmit()}
        >
          Add comment
        </Button>
      </div>
    </aside>
  );
}
