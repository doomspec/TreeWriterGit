import { FileUp } from "lucide-react";

import { useDocxImportModal } from "@/components/paper/DocxImportModalContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Opens the Word import modal for the active paper. */
export function DocxImportActionButton({
  paperSlug,
  className,
  iconOnly = false,
  disabled = false,
}: {
  paperSlug: string;
  className?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const { openDocxImport } = useDocxImportModal();
  const label = "Import from Word";

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("sidebar-pane-icon-btn", className)}
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={openDocxImport}
      >
        <FileUp className="sidebar-pane-icon shrink-0" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-8 w-full gap-1.5 text-xs", className)}
      title="Import a .docx file (Pandoc conversion; auto-approves imported drafts by default)"
      aria-label={label}
      disabled={disabled}
      onClick={openDocxImport}
    >
      <FileUp className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </Button>
  );
}
