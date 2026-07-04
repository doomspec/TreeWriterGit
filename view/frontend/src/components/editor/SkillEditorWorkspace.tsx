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

function userSkillBasename(pathOrName: string): string {
  const base = pathOrName.replace(/^user\//, "").trim();
  return /\.md$/i.test(base) ? base : `${base}.md`;
}

/**
 * Full-width source editor for a dispatch skill (.treewriter-skills/*.md),
 * opened in the main content area — skills live outside model/ so they
 * can't go through the normal WorkspaceRouter/model-tree editors.
 */
export function SkillEditorWorkspace({
  skillPath,
  onClose,
  onError,
  onSkillsChanged,
}: {
  skillPath: string;
  onClose: () => void;
  onError: (message: string) => void;
  onSkillsChanged?: () => void;
}) {
  const isSystem = skillPath.startsWith("system/");
  const [name, setName] = useState(skillPath);
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const text = await fetchDispatchSkillContent(skillPath);
      setContent(text);
      setLoadedContent(text);
      setName(skillPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [skillPath, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = content !== loadedContent || (!isSystem && name.trim() !== skillPath);

  const handleClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this skill?")) return;
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !content.trim()) return;
    setSaving(true);
    try {
      const newFilename =
        !isSystem && trimmedName !== skillPath
          ? userSkillBasename(trimmedName)
          : undefined;
      await updateDispatchSkill(skillPath, {
        content,
        newFilename:
          newFilename && newFilename !== userSkillBasename(skillPath) ? newFilename : undefined,
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
    if (isSystem) return;
    if (!window.confirm(`Delete skill "${skillPath}"?`)) return;
    setSaving(true);
    try {
      await deleteDispatchSkill(skillPath);
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
          aria-label="Skill path"
          readOnly={isSystem}
          className="h-7 min-w-0 flex-1 max-w-md rounded-md border border-border bg-background px-2 font-mono text-xs"
        />
        <span className="text-[11px] text-muted-foreground">{estimateTokens(content)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!isSystem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title={`Delete ${skillPath}`}
              aria-label={`Delete ${skillPath}`}
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
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
