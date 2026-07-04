import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

import type { AuthorEntry } from "@treewriter/shared";

import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { AuthorsAffiliationsEditor } from "@/components/paper/AuthorsAffiliationsEditor";
import { ContributionsEditor } from "@/components/paper/ContributionsEditor";
import { DocxImportPanel } from "@/components/paper/DocxImportPanel";
import {
  applyTemplateSettings,
  buildCreateManuscriptPayload,
  DOC_TYPE_LABELS,
  structurePreviewFolders,
  validateManuscriptCreate,
} from "@/lib/manuscriptForm";
import { useModalFocusTrap } from "@/lib/useModalFocusTrap";
import {
  createManuscript,
  fetchManuscriptTemplates,
  fetchPaperDetail,
  updateManuscript,
  type DocumentType,
  type ManuscriptTemplate,
} from "@/modelApi";

const DEFAULT_PAPER_TEMPLATE: ManuscriptTemplate = {
  templateId: "plos-one",
  docType: "paper",
  label: "PLOS ONE",
  description: "IMRaD article",
  journal: "PLOS ONE",
  targetWords: 5000,
  sectionOrder: ["introduction", "methods", "results", "discussion", "conclusion", "supporting-information"],
  statusOptions: ["Planning", "Drafting", "Reviewing", "Submitted", "Published"],
  assetDirs: ["figures", "tables", "equations"],
  notesDirs: ["literature", "data", "feedback"],
  requiredFields: ["journal"],
  exportPrimaryFormat: "latex",
};

type WizardStep = 1 | 3;
type DetailsTab = "details" | "authors" | "contributions" | "structure" | "advanced";

export function NewManuscriptModal({
  editSlug,
  initialTab,
  onClose,
  onCreated,
  onError,
}: {
  editSlug?: string;
  initialTab?: DetailsTab;
  onClose: () => void;
  onCreated: (path: string) => void;
  onError: (message: string) => void;
}) {
  const isEdit = Boolean(editSlug);
  const [step, setStep] = useState<WizardStep>(isEdit ? 3 : 1);
  const [docType, setDocType] = useState<DocumentType>("paper");
  const [templates, setTemplates] = useState<ManuscriptTemplate[]>([DEFAULT_PAPER_TEMPLATE]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_PAPER_TEMPLATE.templateId);
  const [title, setTitle] = useState("");
  const [authorEntries, setAuthorEntries] = useState<AuthorEntry[]>([]);
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>(initialTab ?? "details");
  const [importTarget, setImportTarget] = useState<{ slug: string; path: string } | null>(null);
  const [slug, setSlug] = useState("");
  const [targetWords, setTargetWords] = useState(String(DEFAULT_PAPER_TEMPLATE.targetWords));
  const [sectionOrderText, setSectionOrderText] = useState(
    DEFAULT_PAPER_TEMPLATE.sectionOrder.join("\n"),
  );
  const [status, setStatus] = useState(DEFAULT_PAPER_TEMPLATE.statusOptions[0] ?? "Planning");
  const [overleafRepoPath, setOverleafRepoPath] = useState("");
  const [funder, setFunder] = useState("");
  const [program, setProgram] = useState("");
  const [deadline, setDeadline] = useState("");
  const [audience, setAudience] = useState("");
  const [tags, setTags] = useState("");
  const [project, setProject] = useState("");
  const [contributionMode, setContributionMode] = useState<"" | "kernel" | "repository">("");
  const [agentSummary, setAgentSummary] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useModalFocusTrap(true, onClose);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.templateId === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates],
  );

  const applyTemplate = (template: ManuscriptTemplate) => {
    setSelectedTemplateId(template.templateId);
    const settings = applyTemplateSettings(template);
    setTargetWords(settings.targetWords);
    setSectionOrderText(settings.sectionOrderText);
    setStatus(settings.statusOptions[0] ?? "Planning");
  };

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    void fetchManuscriptTemplates(docType)
      .then(({ templates: nextTemplates }) => {
        if (cancelled) return;
        const list = nextTemplates.length > 0 ? nextTemplates : [];
        setTemplates(list);
        if (list[0]) applyTemplate(list[0]);
      })
      .catch(() => {
        if (cancelled) return;
        setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [docType, isEdit]);

  useEffect(() => {
    if (!isEdit || !editSlug) return;
    let cancelled = false;
    void fetchPaperDetail(editSlug)
      .then(({ paper }) => {
        if (cancelled) return;
        setDocType(paper.docType ?? "paper");
        setTitle(paper.title);
        setAuthorEntries(paper.authorDetails ?? []);
        setAffiliations(paper.affiliations ?? []);
        setSlug(paper.slug);
        setTargetWords(String(paper.targetWords));
        setSectionOrderText(paper.sectionOrder.join("\n"));
        setStatus(paper.status);
        setOverleafRepoPath(paper.overleafRepoPath ?? "");
        setFunder(paper.funder ?? "");
        setProgram(paper.program ?? "");
        setDeadline(paper.deadline ?? "");
        setAudience(paper.audience ?? "");
        setTags((paper.tags ?? []).join(", "));
        setProject(paper.project ?? "");
        setContributionMode(paper.contributionMode ?? "");
        setAgentSummary(paper.agentSummary ?? "");
        if (paper.templateId) setSelectedTemplateId(paper.templateId);
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : String(err));
        onClose();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editSlug, isEdit, onClose, onError]);

  useEffect(() => {
    if (isEdit) setDetailsTab(initialTab ?? "details");
  }, [editSlug, initialTab, isEdit]);

  const validate = (): string | null =>
    validateManuscriptCreate({
      title,
      targetWords,
      sectionOrderText,
      docType,
      funder,
      audience,
      template: selectedTemplate,
    });

  /** Runs the create-manuscript request only; used by both normal submit and "create & import". */
  const submitCreate = async (): Promise<{ slug: string; path: string } | null> => {
    const validationError = validate();
    if (validationError) {
      onError(validationError);
      return null;
    }
    setSubmitting(true);
    try {
      const payload = buildCreateManuscriptPayload({
        title,
        docType,
        templateId: selectedTemplateId,
        journal: selectedTemplate?.journal ?? selectedTemplate?.label,
        authors: authorEntries,
        affiliations,
        slug,
        targetWords,
        sectionOrderText,
        status,
        overleafRepoPath,
        funder,
        program,
        deadline,
        audience,
        tags,
        project,
        contributionMode,
        agentSummary,
      });
      const result = await createManuscript(payload);
      return result;
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isEdit) {
      const result = await submitCreate();
      if (result) onCreated(result.path);
      return;
    }
    const validationError = validate();
    if (validationError) {
      onError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const cleanAffiliations = affiliations.map((a) => a.trim()).filter(Boolean);
      const result = await updateManuscript({
        slug: editSlug ?? slug.trim(),
        title: title.trim(),
        authors: authorEntries,
        affiliations: cleanAffiliations,
        journal: docType === "paper" ? selectedTemplate?.journal ?? selectedTemplate?.label : undefined,
        templateId: selectedTemplateId,
        targetWords: Number(targetWords),
        sectionOrder: sectionOrderText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
        status,
        overleafRepoPath: docType === "paper" ? overleafRepoPath.trim() || null : null,
        funder: funder.trim() || null,
        program: program.trim() || null,
        deadline: deadline.trim() || null,
        audience: audience.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        project: project.trim() || null,
        contributionMode: contributionMode || null,
        agentSummary: agentSummary.trim() || null,
      });
      onCreated(result.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportClick = async () => {
    if (isEdit) {
      if (!editSlug) return;
      setImportTarget({ slug: editSlug, path: `papers/${editSlug}` });
      return;
    }
    const result = await submitCreate();
    if (result) setImportTarget(result);
  };

  const structurePreview = selectedTemplate ? structurePreviewFolders(selectedTemplate) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manuscript-form-title"
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-md border border-border bg-background shadow-lg outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="manuscript-form-title" className="text-sm font-semibold">
            {isEdit ? "Edit manuscript" : "New manuscript"}
          </h2>
          <button type="button" className="rounded-sm p-1 hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="px-4 py-6">
            <LoadingSkeleton lines={4} />
          </div>
        ) : (
          <form className="space-y-3 overflow-y-auto px-4 py-4" onSubmit={(e) => void handleSubmit(e)}>
            {!isEdit && step === 1 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Choose the deliverable type.</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["paper", "grant", "report"] as DocumentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`rounded-md border px-3 py-4 text-xs font-medium ${
                        docType === type ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                      }`}
                      onClick={() => {
                        setDocType(type);
                        setStep(3);
                      }}
                    >
                      {DOC_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(isEdit || step === 3) && !importTarget && (
              <>
                {!isEdit ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back to type
                  </button>
                ) : null}

                <div className="flex flex-wrap gap-1 border-b border-border">
                  {(
                    [
                      ["details", "Details"],
                      ["authors", "Authors & affiliations"],
                      ["contributions", "Contributions"],
                      ["structure", "Structure"],
                      ["advanced", "Advanced"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`-mb-px border-b-2 px-2 py-1.5 text-xs font-medium ${
                        detailsTab === id
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setDetailsTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {detailsTab === "details" ? (
                  <>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Title</span>
                  <input
                    className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>

                {!isEdit && templates.length > 0 ? (
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">
                      {docType === "paper" ? "Journal / venue" : "Template"}
                    </span>
                    <select
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const next = templates.find((t) => t.templateId === e.target.value);
                        if (next) applyTemplate(next);
                      }}
                    >
                      {templates.map((template) => (
                        <option key={template.templateId} value={template.templateId}>
                          {docType === "paper" ? template.journal ?? template.label : template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {isEdit && docType === "paper" ? (
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Journal / venue</span>
                    <input
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                      value={selectedTemplate?.journal ?? selectedTemplate?.label ?? ""}
                      readOnly
                    />
                  </label>
                ) : null}

                {docType === "grant" ? (
                  <>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Funder</span>
                      <input
                        className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                        value={funder}
                        onChange={(e) => setFunder(e.target.value)}
                        placeholder="NSF, NIH, ERC…"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Program / FOA (optional)</span>
                      <input
                        className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Deadline (optional)</span>
                      <input
                        type="date"
                        className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {docType === "report" ? (
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Audience</span>
                    <input
                      className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Program officers, lab leadership…"
                    />
                  </label>
                ) : null}

                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Tags (comma-separated, optional)</span>
                  <input
                    className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="nsf, 2026, internal"
                  />
                </label>

                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Project slug (optional)</span>
                  <input
                    className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="roboculture"
                  />
                </label>

                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Slug {isEdit ? "" : "(optional)"}</span>
                  <input
                    className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm disabled:opacity-60"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    readOnly={isEdit}
                    disabled={isEdit}
                  />
                </label>

                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-full text-xs"
                  disabled={submitting}
                  onClick={() => void handleImportClick()}
                >
                  {isEdit ? "Import from Word…" : "Create & import from Word…"}
                </Button>
                  </>
                ) : null}

                {detailsTab === "authors" ? (
                  <AuthorsAffiliationsEditor
                    value={{ authors: authorEntries, affiliations }}
                    onChange={(next) => {
                      setAuthorEntries(next.authors);
                      setAffiliations(next.affiliations);
                    }}
                  />
                ) : null}

                {detailsTab === "contributions" ? (
                  <ContributionsEditor authors={authorEntries} onChange={setAuthorEntries} />
                ) : null}

                {detailsTab === "structure" ? (
                  <div className="space-y-3">
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
                      />
                    </label>
                    {!isEdit ? (
                      <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-[11px]">
                        <div className="mb-1 font-medium">Structure preview</div>
                        <ul className="font-mono text-muted-foreground">
                          {structurePreview.map((folder) => (
                            <li key={folder}>{folder}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {detailsTab === "advanced" ? (
                  <div className="space-y-3">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Status</span>
                      <select
                        className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        {(selectedTemplate?.statusOptions ?? ["Planning"]).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    {docType === "paper" ? (
                      <label className="block text-xs">
                        <span className="mb-1 block font-medium">Overleaf path (optional)</span>
                        <input
                          className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-sm"
                          value={overleafRepoPath}
                          onChange={(e) => setOverleafRepoPath(e.target.value)}
                        />
                      </label>
                    ) : null}
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Agent contribution mode</span>
                      <select
                        className="h-8 w-full rounded-sm border border-border bg-background px-2 text-sm"
                        value={contributionMode}
                        onChange={(e) =>
                          setContributionMode(e.target.value as "" | "kernel" | "repository")
                        }
                      >
                        <option value="">Default</option>
                        <option value="kernel">Kernel (core modules only)</option>
                        <option value="repository">Repository (full codebase)</option>
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Agent summary (optional)</span>
                      <textarea
                        className="min-h-16 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
                        value={agentSummary}
                        onChange={(e) => setAgentSummary(e.target.value)}
                        placeholder="Short triage blurb for AI dispatch (~500 tokens)"
                      />
                    </label>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" className="h-8 px-3 text-xs" disabled={submitting}>
                    {submitting
                      ? isEdit
                        ? "Saving…"
                        : "Creating…"
                      : isEdit
                        ? "Save changes"
                        : "Create manuscript"}
                  </Button>
                </div>
              </>
            )}

            {importTarget ? (
              <div className="flex min-h-0 flex-col">
                <button
                  type="button"
                  className="mb-2 inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setImportTarget(null)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <DocxImportPanel
                  paperSlug={importTarget.slug}
                  paperPath={importTarget.path}
                  onError={onError}
                  onComplete={() => onCreated(importTarget.path)}
                />
                <div className="flex justify-end pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => onCreated(importTarget.path)}
                  >
                    {isEdit ? "Done" : "Skip import"}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use NewManuscriptModal */
export const NewPaperModal = NewManuscriptModal;
