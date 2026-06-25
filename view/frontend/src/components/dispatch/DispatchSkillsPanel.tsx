import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp, FileUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PopoverMenu } from "@/components/ui/PopoverMenu";
import {
  deleteDispatchSkill,
  fetchDispatchSkills,
  patchDispatchSkillsEnabled,
  readMarkdownFile,
  uploadDispatchSkill,
  type DispatchSkill,
} from "@/lib/dispatchSkillsApi";
import { cn } from "@/lib/utils";

const SKILLS_HELP =
  "Upload markdown skill files for dispatch-only rules (structure, writing, context CLI). Enabled skills are appended to each preview prompt — not loaded into every IDE session (unlike project MCP). Auto-prefetch adds sibling outlines and search hits before the agent runs.";

function formatSkillSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function DispatchSkillsPanel({
  onError,
  onSkillsChanged,
  className,
}: {
  onError: (message: string) => void;
  onSkillsChanged?: () => void;
  className?: string;
}) {
  const [skills, setSkills] = useState<DispatchSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSkills(await fetchDispatchSkills());
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const notifyChanged = useCallback(() => {
    onSkillsChanged?.();
  }, [onSkillsChanged]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setNotice(null);
    try {
      const content = await readMarkdownFile(file);
      const skill = await uploadDispatchSkill(file.name, content);
      await reload();
      notifyChanged();
      if (skill.filename !== file.name) {
        setNotice(`Saved as ${skill.filename} (filename adjusted).`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleEnabled = async (skill: DispatchSkill, checked: boolean) => {
    setBusyName(skill.filename);
    try {
      const enabled = skills.filter((entry) => entry.enabled).map((entry) => entry.filename);
      const next = checked
        ? [...new Set([...enabled, skill.filename])]
        : enabled.filter((name) => name !== skill.filename);
      setSkills(await patchDispatchSkillsEnabled(next));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyName(null);
    }
  };

  const handleDelete = async (skill: DispatchSkill) => {
    if (!window.confirm(`Delete skill "${skill.title}"?`)) return;
    setBusyName(skill.filename);
    try {
      setSkills(await deleteDispatchSkill(skill.filename));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div className={cn("dispatch-skills-panel flex min-h-0 flex-1 flex-col", className)}>
      <div className="dispatch-skills-panel__header shrink-0">
        <div className="dispatch-skills-panel__title-row">
          <p className="truncate text-xs font-medium text-foreground">Dispatch skills</p>
          <PopoverMenu
            aria-label="About dispatch skills"
            align="start"
            title={SKILLS_HELP}
            triggerClassName="h-6 w-6 shrink-0 px-0 text-muted-foreground"
            menuClassName="max-w-[min(18rem,calc(100vw-1.5rem))] p-2.5"
            trigger={<CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            <p className="text-[11px] leading-relaxed text-muted-foreground">{SKILLS_HELP}</p>
          </PopoverMenu>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="dispatch-skills-panel__upload h-7 gap-1 bg-card px-2 text-[10px]"
          disabled={uploading}
          title="Upload a markdown skill file"
          aria-label={uploading ? "Uploading skill" : "Upload markdown skill file"}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="dispatch-skills-panel__upload-label">
            {uploading ? "Uploading…" : "Upload .md"}
          </span>
        </Button>
        {notice ? (
          <p className="dispatch-skills-panel__notice w-full text-[10px] leading-snug text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="dispatch-skills-panel__list">
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Loading skills…</p>
        ) : skills.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No skills yet. Upload a <code className="rounded bg-muted px-1">.md</code> file with a{" "}
            <code className="rounded bg-muted px-1"># Title</code> heading. Include{" "}
            <code className="rounded bg-muted px-1">treewriter-context-cli.md</code> from{" "}
            <code className="rounded bg-muted px-1">.treewriter-skills/</code> for on-demand context lookup.
          </p>
        ) : (
          <ul className="dispatch-skills-panel__items" role="list">
            {skills.map((skill) => (
              <li key={skill.filename} className="dispatch-skills-panel__item">
                <input
                  type="checkbox"
                  className="dispatch-skills-panel__checkbox shrink-0"
                  checked={skill.enabled}
                  disabled={busyName === skill.filename}
                  aria-label={`Use ${skill.title} in dispatch`}
                  onChange={(event) => void toggleEnabled(skill, event.target.checked)}
                />
                <div className="dispatch-skills-panel__item-body min-w-0">
                  <p className="dispatch-skills-panel__item-title" title={skill.title}>
                    {skill.title}
                  </p>
                  <p
                    className="dispatch-skills-panel__item-meta"
                    title={`${skill.filename} · ${formatSkillSize(skill.size)}`}
                  >
                    {skill.filename} · {formatSkillSize(skill.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="dispatch-skills-panel__delete h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  title={`Delete ${skill.filename}`}
                  aria-label={`Delete ${skill.filename}`}
                  disabled={busyName === skill.filename}
                  onClick={() => void handleDelete(skill)}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
