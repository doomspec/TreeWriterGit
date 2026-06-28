import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, Trash2, X } from "lucide-react";

import { AssigneeBadge, CommentAuthorChip } from "@/components/editor/CommentMetaChips";
import { Button } from "@/components/ui/button";
import {
  buildAssigneeOptions,
  commentAssignedToCurrentUser,
  loadAiProviderNames,
  matchesCommentFilter,
  type CommentAssigneeOption,
  type CommentFilter,
} from "@/lib/commentAssignees";
import { sortCommentsByLine } from "@/lib/sortCommentsByLine";
import { cn } from "@/lib/utils";
import { getCommentAuthor, getUserName, hasCommentAuthorIdentity, setUserName } from "@/lib/userIdentity";
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
  type CommentRecord,
} from "@/modelApi";

const FILTER_OPTIONS: { id: CommentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Assigned to me" },
  { id: "ai", label: "Assigned to AI" },
  { id: "unassigned", label: "Unassigned" },
];

export function CommentsPanel({
  filePath,
  paneLabel,
  refreshVersion,
  selectedLine = 1,
  overlay = false,
  onError,
  onClose,
  onUnresolvedChange,
  onCommentsChange,
  onNavigateToLine,
}: {
  filePath: string;
  paneLabel?: string;
  refreshVersion: number;
  selectedLine?: number;
  overlay?: boolean;
  onError?: (message: string) => void;
  onClose?: () => void;
  onUnresolvedChange?: (count: number) => void;
  onCommentsChange?: (comments: CommentRecord[]) => void;
  onNavigateToLine?: (line: number) => void;
}) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [line, setLine] = useState(selectedLine);
  const [submitting, setSubmitting] = useState(false);
  const [authorName, setAuthorNameState] = useState(() => getUserName());
  const [nameDraft, setNameDraft] = useState(() => getUserName());
  const [filter, setFilter] = useState<CommentFilter>("all");
  const [aiProviders, setAiProviders] = useState<{ name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const needsName = !hasCommentAuthorIdentity() && (authorName === "Anonymous" || !authorName.trim());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { comments: next } = await fetchComments(filePath);
      setComments(sortCommentsByLine(next));
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
    void loadAiProviderNames().then(setAiProviders);
  }, []);

  useEffect(() => {
    setLine(selectedLine);
  }, [selectedLine]);

  const assigneeOptions = useMemo(
    () => buildAssigneeOptions(comments, aiProviders),
    [aiProviders, comments],
  );

  const visibleComments = useMemo(
    () => comments.filter((comment) => matchesCommentFilter(comment, filter)),
    [comments, filter],
  );

  const unresolved = useMemo(() => comments.filter((c) => !c.resolved).length, [comments]);

  useEffect(() => {
    onUnresolvedChange?.(unresolved);
  }, [onUnresolvedChange, unresolved]);

  useEffect(() => {
    onCommentsChange?.(comments);
  }, [comments, onCommentsChange]);

  const saveAuthorName = () => {
    const next = nameDraft.trim() || "Anonymous";
    setUserName(next);
    setAuthorNameState(next);
  };

  const assignerLabel = () => getCommentAuthor() || authorName;

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    if (needsName && !nameDraft.trim()) return;
    if (needsName) saveAuthorName();
    setSubmitting(true);
    try {
      const author = getCommentAuthor() || (needsName ? nameDraft.trim() : authorName);
      await createComment({ path: filePath, line, author, text: draft.trim() });
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

  const handleAssign = async (comment: CommentRecord, optionKey: string) => {
    const option = assigneeOptions.find((entry) => entry.key === optionKey);
    try {
      await updateComment(comment.id, {
        path: filePath,
        assigned_to: option
          ? { type: option.type, id: option.id, label: option.label }
          : null,
        assigned_by: assignerLabel(),
      });
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  const saveEdit = async (comment: CommentRecord) => {
    if (!editDraft.trim()) return;
    try {
      await updateComment(comment.id, { path: filePath, text: editDraft.trim() });
      setEditingId(null);
      setEditDraft("");
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  const panelTitle = paneLabel ? `${paneLabel} comments` : "Comments";

  return (
    <aside
      className={cn(
        "flex w-72 max-w-full flex-col border-l border-border bg-card",
        overlay ? "absolute inset-y-0 right-0 z-20 shrink-0 shadow-lg" : "h-full shrink-0",
      )}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate capitalize">{panelTitle}</span>
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

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-2 py-1.5">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={filter === option.id ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : visibleComments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments match this filter.</p>
        ) : (
          visibleComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              assigneeOptions={assigneeOptions}
              editing={editingId === comment.id}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onStartEdit={() => {
                setEditingId(comment.id);
                setEditDraft(comment.text);
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditDraft("");
              }}
              onSaveEdit={() => void saveEdit(comment)}
              onToggleResolved={() => void toggleResolved(comment)}
              onDelete={() => void handleDelete(comment)}
              onAssign={(key) => void handleAssign(comment, key)}
              onNavigateToLine={onNavigateToLine}
            />
          ))
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        {needsName ? (
          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium text-muted-foreground">
              Your name (shown to collaborators)
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none ring-primary focus:ring-1"
                placeholder="Your name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={!nameDraft.trim()}
                onClick={saveAuthorName}
              >
                Save
              </Button>
            </div>
          </div>
        ) : null}
        <label className="block text-[10px] text-muted-foreground">
          <span className="mb-0.5 block">Line in file</span>
          <input
            type="number"
            min={1}
            className="h-6 w-16 rounded border border-border bg-background px-1.5 text-xs"
            value={line}
            title="Line number where this comment is anchored (updates when you click in the editor)"
            aria-describedby="comment-line-hint"
            onChange={(e) => setLine(Math.max(1, Number(e.target.value) || 1))}
          />
          <span id="comment-line-hint" className="mt-0.5 block text-[9px] leading-snug">
            Anchors the comment to that line; follows your cursor when you edit.
          </span>
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
          disabled={submitting || !draft.trim() || (needsName && !nameDraft.trim())}
          onClick={() => void handleSubmit()}
        >
          Add comment
        </Button>
      </div>
    </aside>
  );
}

function CommentCard({
  comment,
  assigneeOptions,
  editing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleResolved,
  onDelete,
  onAssign,
  onNavigateToLine,
}: {
  comment: CommentRecord;
  assigneeOptions: CommentAssigneeOption[];
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleResolved: () => void;
  onDelete: () => void;
  onAssign: (optionKey: string) => void;
  onNavigateToLine?: (line: number) => void;
}) {
  const assigneeKey = comment.assigned_to
    ? `${comment.assigned_to.type}:${comment.assigned_to.id}`
    : "";

  return (
    <div
      className={cn(
        "rounded-md border border-border/80 px-2.5 py-2 text-xs",
        comment.resolved && "opacity-60",
        commentAssignedToCurrentUser(comment) && !comment.resolved && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <CommentAuthorChip author={comment.author} />
          <span className="truncate font-medium">{comment.author}</span>
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => onNavigateToLine?.(comment.line)}
        >
          L{comment.line}
        </button>
      </div>

      {comment.assigned_to ? (
        <div className="mb-1">
          <AssigneeBadge assignee={comment.assigned_to} />
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            className="h-16 w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs"
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
          />
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-6 px-2 text-[10px]" onClick={onSaveEdit}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-foreground/90">{comment.text}</p>
      )}

      <div className="mt-2 space-y-1.5">
        <label className="block text-[10px] text-muted-foreground">
          Assign to
          <select
            className="mt-0.5 h-6 w-full rounded border border-border bg-background px-1.5 text-[10px]"
            value={assigneeKey}
            onChange={(e) => onAssign(e.target.value)}
          >
            <option value="">Unassigned</option>
            {assigneeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.type === "ai" ? `AI: ${option.label}` : option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px]"
            onClick={onToggleResolved}
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            {comment.resolved ? "Reopen" : "Resolve"}
          </Button>
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={onStartEdit}
            >
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px] text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
