import { DocxImportConfirmDialog } from "@/components/paper/DocxImportConfirmDialog";
import { DOCX_ACCEPT } from "@/lib/useDocxImportFlow";
import type { useDocxImportFlow } from "@/lib/useDocxImportFlow";

type DocxImportFlow = ReturnType<typeof useDocxImportFlow>;

export function DocxImportFlowDialogs({
  flow,
}: {
  flow: DocxImportFlow;
}) {
  return (
    <>
      <input
        ref={flow.inputRef}
        type="file"
        accept={DOCX_ACCEPT}
        className="sr-only"
        disabled={flow.disabled || flow.previewLoading}
        onChange={(event) => flow.pickFile(event.target.files?.[0] ?? null)}
      />
      <DocxImportConfirmDialog
        open={flow.confirmOpen}
        preview={flow.preview}
        previewError={flow.previewError}
        targetSection={flow.targetSection}
        replaceExisting={flow.replaceExisting}
        importedPlan={flow.importedPlan}
        loading={flow.previewLoading}
        importing={flow.importing}
        onTargetSectionChange={flow.handleTargetSectionChange}
        onReplaceExistingChange={flow.handleReplaceExistingChange}
        onImportedPlanChange={flow.setImportedPlan}
        onConfirm={() => void flow.handleConfirmImport()}
        onCancel={flow.cancelConfirm}
      />
    </>
  );
}
