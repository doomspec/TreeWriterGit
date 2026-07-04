import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, FilePlus, FileUp, MoreHorizontal, RotateCcw, Tag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PopoverMenu, PopoverMenuItem } from "@/components/ui/PopoverMenu";
import {
  deleteDispatchSkill,
  fetchDispatchSkills,
  patchDispatchSkillsEnabled,
  readMarkdownFile,
  resetSystemSkill,
  updateDispatchSkill,
  uploadDispatchSkill,
  type DispatchSkill,
} from "@/lib/dispatchSkillsApi";
import { cn } from "@/lib/utils";

const SKILLS_HELP =
  "System skills (TreeWriter runtime + action prompts) always load. Your skills are optional writing rules — toggle to include in each dispatch preview.";

function skillTemplate(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new-skill";
  const heading = title.trim() || "New skill";
  return `---
name: ${slug}
description: Use when the user wants… (one trigger per branch).
---

# ${heading}

<One line: the behaviour this skill makes predictable.>

## Checklist

- [ ] <verifiable end condition>
`;
}

function formatSkillSize(bytes: number): string {
  const tokens = Math.round(bytes / 4);
  return tokens < 1000 ? `~${tokens} tokens` : `~${(tokens / 1000).toFixed(1)}k tokens`;
}

function SkillRow({
  skill,
  busy,
  onEdit,
  onToggle,
  onDelete,
  onRename,
  onReset,
}: {
  skill: DispatchSkill;
  busy: boolean;
  onEdit: () => void;
  onToggle?: (checked: boolean) => void;
  onDelete?: () => void;
  onRename?: () => void;
  onReset?: () => void;
}) {
  const isSystem = skill.tier === "system";
  return (
    <li className="dispatch-skills-panel__item-wrapper">
      <div className="dispatch-skills-panel__item">
        {!isSystem && onToggle ? (
          <input
            type="checkbox"
            className="dispatch-skills-panel__checkbox shrink-0"
            checked={skill.enabled}
            disabled={busy}
            aria-label={`Use ${skill.title} in dispatch`}
            onChange={(event) => onToggle(event.target.checked)}
          />
        ) : (
          <span className="dispatch-skills-panel__system-badge shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
            {skill.subkind === "action" ? "Action" : "System"}
          </span>
        )}
        <button
          type="button"
          className="dispatch-skills-panel__item-body min-w-0 flex-1 rounded-sm text-left hover:bg-accent/40"
          title={`Edit ${skill.skillPath}`}
          aria-label={`Edit ${skill.title}`}
          disabled={busy}
          onClick={onEdit}
        >
          <p className="dispatch-skills-panel__item-title" title={skill.title}>
            {skill.title}
          </p>
          <p
            className="dispatch-skills-panel__item-meta"
            title={`${skill.skillPath} · ${formatSkillSize(skill.size)}`}
          >
            {skill.skillPath} · {formatSkillSize(skill.size)}
          </p>
        </button>
        <PopoverMenu
          aria-label={`Actions for ${skill.title}`}
          triggerClassName="h-6 w-6 shrink-0 px-0 text-muted-foreground hover:text-foreground"
          menuClassName="min-w-[8rem] p-1"
          disabled={busy}
          trigger={<MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {isSystem && onReset ? (
            <PopoverMenuItem onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Reset
            </PopoverMenuItem>
          ) : null}
          {!isSystem && onRename ? (
            <PopoverMenuItem onClick={onRename}>
              <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Rename
            </PopoverMenuItem>
          ) : null}
          {!isSystem && onDelete ? (
            <PopoverMenuItem className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Delete
            </PopoverMenuItem>
          ) : null}
        </PopoverMenu>
      </div>
    </li>
  );
}

export function DispatchSkillsPanel({
  onError,
  onSkillsChanged,
  onEditSkill,
  className,
}: {
  onError: (message: string) => void;
  onSkillsChanged?: () => void;
  onEditSkill: (skillPath: string) => void;
  className?: string;
}) {
  const [skills, setSkills] = useState<DispatchSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
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

  const systemRules = useMemo(
    () => skills.filter((s) => s.tier === "system" && s.subkind === "rule"),
    [skills],
  );
  const systemActions = useMemo(
    () => skills.filter((s) => s.tier === "system" && s.subkind === "action"),
    [skills],
  );
  const userSkills = useMemo(() => skills.filter((s) => s.tier === "user"), [skills]);

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

  const handleCreate = async () => {
    const raw = window.prompt("New skill name (e.g. abstract-review)");
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;
    const filename = /\.md$/i.test(name) ? name : `${name}.md`;
    setCreating(true);
    setNotice(null);
    try {
      const skill = await uploadDispatchSkill(filename, skillTemplate(name.replace(/\.md$/i, "")));
      await reload();
      notifyChanged();
      onEditSkill(skill.skillPath);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (skill: DispatchSkill, checked: boolean) => {
    setBusyPath(skill.skillPath);
    try {
      const enabled = userSkills.filter((entry) => entry.enabled).map((entry) => entry.filename);
      const next = checked
        ? [...new Set([...enabled, skill.filename])]
        : enabled.filter((name) => name !== skill.filename);
      setSkills(await patchDispatchSkillsEnabled(next));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPath(null);
    }
  };

  const handleDelete = async (skill: DispatchSkill) => {
    if (!window.confirm(`Delete skill "${skill.title}"?`)) return;
    setBusyPath(skill.skillPath);
    try {
      setSkills(await deleteDispatchSkill(skill.skillPath));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPath(null);
    }
  };

  const handleRename = async (skill: DispatchSkill) => {
    const raw = window.prompt(`Rename ${skill.filename} to:`, skill.filename);
    if (raw === null) return;
    const name = raw.trim();
    if (!name || name === skill.filename) return;
    const newFilename = /\.md$/i.test(name) ? name : `${name}.md`;
    setBusyPath(skill.skillPath);
    try {
      setSkills(await updateDispatchSkill(skill.skillPath, { newFilename }));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPath(null);
    }
  };

  const handleReset = async (skill: DispatchSkill) => {
    if (!window.confirm(`Reset "${skill.title}" to the shipped default?`)) return;
    setBusyPath(skill.skillPath);
    try {
      setSkills(await resetSystemSkill(skill.skillPath));
      notifyChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyPath(null);
    }
  };

  const renderSection = (title: string, items: DispatchSkill[], variant: "system" | "user") => (
    <div className="dispatch-skills-panel__section mb-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">None</p>
      ) : (
        <ul className="dispatch-skills-panel__items" role="list">
          {items.map((skill) => (
            <SkillRow
              key={skill.skillPath}
              skill={skill}
              busy={busyPath === skill.skillPath}
              onEdit={() => onEditSkill(skill.skillPath)}
              onToggle={variant === "user" ? (checked) => void toggleEnabled(skill, checked) : undefined}
              onDelete={variant === "user" ? () => void handleDelete(skill) : undefined}
              onRename={variant === "user" ? () => void handleRename(skill) : undefined}
              onReset={variant === "system" ? () => void handleReset(skill) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className={cn("dispatch-skills-panel flex min-h-0 flex-1 flex-col", className)}>
      <div className="dispatch-skills-panel__header shrink-0">
        <div className="dispatch-skills-panel__toolbar flex w-full min-w-0 items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
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
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="dispatch-skills-panel__new h-7 shrink-0 gap-1 bg-card px-2 text-[10px]"
              disabled={creating}
              title="Create a new user skill from a template"
              aria-label={creating ? "Creating skill" : "New skill from template"}
              onClick={() => void handleCreate()}
            >
              <FilePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="dispatch-skills-panel__new-label">{creating ? "Creating…" : "New skill"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="dispatch-skills-panel__upload h-7 shrink-0 gap-1 bg-card px-2 text-[10px]"
              disabled={uploading}
              title="Upload a user skill markdown file"
              aria-label={uploading ? "Uploading skill" : "Upload markdown skill file"}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="dispatch-skills-panel__upload-label">{uploading ? "Uploading…" : "Upload .md"}</span>
            </Button>
          </div>
        </div>
        {notice ? (
          <p className="dispatch-skills-panel__notice w-full text-[10px] leading-snug text-muted-foreground">{notice}</p>
        ) : null}
      </div>

      <div className="dispatch-skills-panel__list min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Loading skills…</p>
        ) : skills.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No skills yet. Use <strong>New skill</strong> or <strong>Upload .md</strong> for custom writing rules.
          </p>
        ) : (
          <>
            {renderSection("System — core rules", systemRules, "system")}
            {renderSection("System — action prompts", systemActions, "system")}
            {renderSection("Your skills", userSkills, "user")}
          </>
        )}
      </div>
    </div>
  );
}
