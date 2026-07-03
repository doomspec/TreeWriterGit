import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  deleteDispatchSkill,
  fetchDispatchSkillContent,
  updateDispatchSkill,
} from "@/lib/dispatchSkillsApi";

/** ~4 chars/token — good enough to gauge prompt-budget impact, not exact. */
function estimateTokens(text: string): string {
  const tokens = Math.round(text.length / 4);
  return tokens < 1000 ? `~${tokens} tokens` : `~${(tokens / 1000).toFixed(1)}k tokens`;
}

/**
 * Full-width source editor for a dispatch skill (.treewriter-skills/*.md),
 * opened in the main content area — skills live outside model/ so they
 * can't go through the normal WorkspaceRouter/model-tree editors.
 */
export function SkillEditorWorkspace({
  filename,
  onClose,
  onError,
  onSkillsChanged,
}: {
  filename: string;
  onClose: () => void;
  onError: (message: string) => void;
  onSkillsChanged?: () => void;
}) {
  const [name, setName] = useState(filename);
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const text = await fetchDispatchSkillContent(filename);
      setContent(text);
      setLoadedContent(text);
      setName(filename);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = content !== loadedContent || name.trim() !== filename;

  const handleClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this skill?")) return;
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !content.trim()) return;
    setSaving(true);
    try {
      await updateDispatchSkill(filename, {
        content,
        newFilename: trimmedName !== filename ? trimmedName : undefined,
      });
      onSkillsChanged?.();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete skill "${filename}"?`)) return;
    setSaving(true);
    try {
      await deleteDispatchSkill(filename);
      onSkillsChanged?.();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={handleClose}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </Button>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Skill filename"
          className="h-7 min-w-0 flex-1 max-w-xs rounded-md border border-border bg-background px-2 font-mono text-xs"
        />
        <span className="text-[11px] text-muted-foreground">{estimateTokens(content)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title={`Delete ${filename}`}
            aria-label={`Delete ${filename}`}
            disabled={saving}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={saving || loading || !dirty || !content.trim() || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading skill…</p>
        ) : (
          <textarea
            aria-label="Skill content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>
    </div>
  );
}
