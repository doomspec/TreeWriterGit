import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createPaper,
  fetchJournalTemplates,
  fetchPaperDetail,
  updatePaper,
  type JournalTemplate,
} from "@/modelApi";

const PAPER_STATUSES = ["Planning", "Drafting", "Reviewing", "Submitted", "Published"] as const;

const DEFAULT_TEMPLATE: JournalTemplate = {
  journal: "PLOS ONE",
  targetWords: 5000,
  sectionOrder: ["introduction", "methods", "results", "discussion", "conclusion", "supporting-information"],
};

function applyTemplateSettings(template: JournalTemplate) {
  return {
    targetWords: String(template.targetWords),
    sectionOrderText: template.sectionOrder.join("\n"),
  };
}

function parseSectionOrder(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function NewPaperModal({
  editSlug,
  onClose,
  onCreated,
  onError,
}: {
  editSlug?: string;
  onClose: () => void;
  onCreated: (path: string) => void;
  onError: (message: string) => void;
}) {
  const isEdit = Boolean(editSlug);
  const [title, setTitle] = useState("");
  const [journal, setJournal] = useState("");
  const [authors, setAuthors] = useState("");
  const [slug, setSlug] = useState("");
  const [templates, setTemplates] = useState<JournalTemplate[]>([DEFAULT_TEMPLATE]);
  const [targetWords, setTargetWords] = useState(String(DEFAULT_TEMPLATE.targetWords));
  const [sectionOrderText, setSectionOrderText] = useState(DEFAULT_TEMPLATE.sectionOrder.join("\n"));
  const [status, setStatus] = useState<(typeof PAPER_STATUSES)[number]>("Planning");
  const [overleafRepoPath, setOverleafRepoPath] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchJournalTemplates()
      .then((data) => {
        if (cancelled) return;
        const nextTemplates = data.templates.length > 0 ? data.templates : [DEFAULT_TEMPLATE];
        setTemplates(nextTemplates);
        if (!isEdit) {
          const first = nextTemplates[0];
          if (first) {
            setJournal(first.journal);
            const settings = applyTemplateSettings(first);
            setTargetWords(settings.targetWords);
            setSectionOrderText(settings.sectionOrderText);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTemplates([DEFAULT_TEMPLATE]);
        if (!isEdit) setJournal(DEFAULT_TEMPLATE.journal);
      });

    if (isEdit && editSlug) {
      void fetchPaperDetail(editSlug)
        .then(({ paper }) => {
          if (cancelled) return;
          setTitle(paper.title);
          setJournal(paper.journal || DEFAULT_TEMPLATE.journal);
          setAuthors(paper.authors.join(", "));
          setSlug(paper.slug);
          setTargetWords(String(paper.targetWords));
          setSectionOrderText(paper.sectionOrder.join("\n"));
          setStatus(
            PAPER_STATUSES.includes(paper.status as (typeof PAPER_STATUSES)[number])
              ? (paper.status as (typeof PAPER_STATUSES)[number])
              : "Planning",
          );
          setOverleafRepoPath(paper.overleafRepoPath ?? "");
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : String(err));
          onClose();
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [editSlug, isEdit, onClose, onError]);

  const handleJournalChange = (nextJournal: string) => {
    setJournal(nextJournal);
    if (isEdit) return;
    const template = templates.find((item) => item.journal === nextJournal);
    if (!template) return;
    const settings = applyTemplateSettings(template);
    setTargetWords(settings.targetWords);
    setSectionOrderText(settings.sectionOrderText);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      onError("Title is required");
      return;
    }
    const parsedTargetWords = Number(targetWords);
    if (!Number.isFinite(parsedTargetWords) || parsedTargetWords <= 0) {
      onError("Target words must be a positive number");
      return;
    }
    const sectionOrder = parseSectionOrder(sectionOrderText);
    if (sectionOrder.length === 0) {
      onError("Add at least one section");
      return;
    }
    setSubmitting(true);
    try {
      const authorList = authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const payload = {
        title: title.trim(),
        journal: journal.trim() || DEFAULT_TEMPLATE.journal,
        authors: authorList,
        targetWords: parsedTargetWords,
        sectionOrder,
        status,
        overleafRepoPath: overleafRepoPath.trim() || null,
      };
      const result = isEdit
        ? await updatePaper({ ...payload, slug: editSlug ?? slug.trim() })
        : await createPaper({
            ...payload,
            slug: slug.trim() || undefined,
          });
      onCreated(result.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const journalOptions =
    templates.length > 0 ? templates.map((template) => template.journal) : [DEFAULT_TEMPLATE.journal];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-labelledby="paper-form-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-md border border-border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="paper-form-title" className="text-sm font-semibold">
            {isEdit ? "Edit paper" : "New paper"}
          </h2>
          <button type="button" className="rounded-sm p-1 hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading paper…</p>
        ) : (
          <form className="space-y-3 overflow-y-auto px-4 py-4" onSubmit={(e) => void handleSubmit(e)}>
            <label className="block text-xs">
              <span className="mb-1 block font-medium">Title</span>
              <input
                className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-medium">Journal template</span>
              <select
                className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                value={journal}
                onChange={(e) => handleJournalChange(e.target.value)}
              >
                {journalOptions.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-medium">Authors (comma-separated)</span>
              <input
                className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Alice Smith, Bob Jones"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-medium">Slug {isEdit ? "" : "(optional)"}</span>
              <input
                className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm disabled:opacity-60"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from title"
                readOnly={isEdit}
                disabled={isEdit}
              />
            </label>

            <div className="rounded-sm border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-accent/50"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                Paper settings
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {settingsOpen ? (
                <div className="space-y-3 border-t border-border px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    {isEdit
                      ? "Update metadata stored in the paper INDEX.md. Section folders are not added or removed automatically."
                      : "Prefilled from the journal template. Edit before creating if you need a custom structure."}
                  </p>

                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Target words</span>
                    <input
                      type="number"
                      min={1}
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                      value={targetWords}
                      onChange={(e) => setTargetWords(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Section order</span>
                    <textarea
                      className="min-h-28 w-full rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-xs"
                      value={sectionOrderText}
                      onChange={(e) => setSectionOrderText(e.target.value)}
                      placeholder={"introduction\nmethods\nresults"}
                    />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      One section folder name per line (lowercase, hyphens allowed).
                    </span>
                  </label>

                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Status</span>
                    <select
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as (typeof PAPER_STATUSES)[number])}
                    >
                      {PAPER_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Overleaf repo path (optional)</span>
                    <input
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm"
                      value={overleafRepoPath}
                      onChange={(e) => setOverleafRepoPath(e.target.value)}
                      placeholder="/path/to/overleaf/project"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="h-8 px-3 text-xs" disabled={submitting}>
                {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create paper"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
