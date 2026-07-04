import { useCallback, useRef, useState } from "react";

import { cloneImportPlan } from "@/lib/docxImportPlanEdit";
import { importDocxIntoPaper, previewDocxImport } from "@/modelApi";
import type { DocxImportPreview, DocxImportPreviewNode } from "@treewriter/shared";

export const DOCX_ACCEPT =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function defaultImportTargetSection(
  paperPath: string | null,
  browsePath: string | null,
  activeFile: string | null,
): string {
  if (!paperPath) return "";
  let folder = browsePath ?? "";
  if (activeFile?.startsWith(`${paperPath}/`) && activeFile.endsWith(".md")) {
    folder = activeFile.slice(0, activeFile.lastIndexOf("/"));
  }
  if (!folder.startsWith(`${paperPath}/`) || folder === paperPath) return "";
  return folder.slice(paperPath.length + 1);
}

export function useDocxImportFlow({
  paperSlug,
  paperPath,
  browsePath,
  activeFile,
  onError,
  onComplete,
  autoApproveDefault = true,
}: {
  paperSlug: string | null;
  paperPath?: string | null;
  browsePath?: string | null;
  activeFile?: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  autoApproveDefault?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [autoApprove, setAutoApprove] = useState(autoApproveDefault);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<DocxImportPreview | null>(null);
  const [importedPlan, setImportedPlan] = useState<DocxImportPreviewNode[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [targetSection, setTargetSection] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const disabled = !paperSlug || importing;

  const loadPreview = useCallback(
    async (nextFile: File, nextTargetSection: string, nextReplaceExisting: boolean) => {
      if (!paperSlug) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await previewDocxImport({
          paperSlug,
          file: nextFile,
          targetSection: nextTargetSection || undefined,
          replaceTarget: nextReplaceExisting,
        });
        setPreview(result);
        setImportedPlan(cloneImportPlan(result.imported));
        setTargetSection(result.importTargetSlug);
        setReplaceExisting(result.replaceExisting);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPreviewError(message);
        setPreview(null);
        onError(message);
      } finally {
        setPreviewLoading(false);
      }
    },
    [onError, paperSlug],
  );

  const beginReview = useCallback(
    async (nextFile: File) => {
      const initialTarget = defaultImportTargetSection(
        paperPath ?? null,
        browsePath ?? null,
        activeFile ?? null,
      );
      setFile(nextFile);
      setNotice(null);
      setPreview(null);
      setImportedPlan([]);
      setPreviewError(null);
      setTargetSection(initialTarget);
      setReplaceExisting(true);
      setConfirmOpen(true);
      await loadPreview(nextFile, initialTarget, true);
    },
    [activeFile, browsePath, loadPreview, paperPath],
  );

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setFile(null);
        setConfirmOpen(false);
        setPreview(null);
        setPreviewError(null);
        return;
      }
      const name = next.name.toLowerCase();
      if (!name.endsWith(".docx")) {
        onError("Please choose a .docx Word document.");
        return;
      }
      void beginReview(next);
    },
    [beginReview, onError],
  );

  const handleTargetSectionChange = useCallback(
    (slug: string) => {
      setTargetSection(slug);
      if (file) void loadPreview(file, slug, replaceExisting);
    },
    [file, loadPreview, replaceExisting],
  );

  const handleReplaceExistingChange = useCallback(
    (value: boolean) => {
      setReplaceExisting(value);
      if (file) void loadPreview(file, targetSection, value);
    },
    [file, loadPreview, targetSection],
  );

  const handleConfirmImport = useCallback(async () => {
    if (!paperSlug || !file || !preview) return;
    setImporting(true);
    setNotice(null);
    try {
      const result = await importDocxIntoPaper({
        paperSlug,
        file,
        autoApprove,
        targetSection: targetSection || undefined,
        replaceTarget: replaceExisting,
        importPlan: importedPlan,
      });
      const summary = [
        `Imported ${result.sectionsCreated} section${result.sectionsCreated === 1 ? "" : "s"}`,
        `${result.unitsCreated} unit${result.unitsCreated === 1 ? "" : "s"}`,
      ].join(" and ");
      setNotice(
        result.notice
          ? `${summary}. ${result.notice}`
          : result.paperTitle
            ? `${summary} from “${result.paperTitle}”.`
            : `${summary}.`,
      );
      setFile(null);
      setConfirmOpen(false);
      setPreview(null);
      setImportedPlan([]);
      setPreviewError(null);
      if (inputRef.current) inputRef.current.value = "";
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }, [
    autoApprove,
    file,
    importedPlan,
    onComplete,
    onError,
    paperSlug,
    preview,
    replaceExisting,
    targetSection,
  ]);

  const cancelConfirm = useCallback(() => {
    if (importing) return;
    setConfirmOpen(false);
    setPreview(null);
    setPreviewError(null);
  }, [importing]);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    inputRef,
    disabled,
    autoApprove,
    setAutoApprove,
    notice,
    confirmOpen,
    preview,
    previewError,
    targetSection,
    replaceExisting,
    importedPlan,
    setImportedPlan,
    previewLoading,
    importing,
    file,
    pickFile,
    beginReview,
    handleTargetSectionChange,
    handleReplaceExistingChange,
    handleConfirmImport,
    cancelConfirm,
    openFilePicker,
  };
}
