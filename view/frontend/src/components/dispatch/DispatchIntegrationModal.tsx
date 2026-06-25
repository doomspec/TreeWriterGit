import { DispatchIntegrationPanel } from "@/components/dispatch/DispatchIntegrationPanel";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function DispatchIntegrationModal({
  open,
  onClose,
  currentPath,
  previewPrompt,
  previewCommand,
}: {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  previewPrompt?: string | null;
  previewCommand?: string | null;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="dispatch-integration-title"
        aria-modal="true"
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="dispatch-integration-title" className="text-base font-semibold">
              AI Assistant Integration
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Copy prompts for external assistants, review dispatch workflow, or copy context CLI
              commands for on-demand manuscript lookup (no project MCP).
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <DispatchIntegrationPanel
          currentPath={currentPath}
          previewPrompt={previewPrompt}
          previewCommand={previewCommand}
        />
      </div>
    </div>
  );
}
