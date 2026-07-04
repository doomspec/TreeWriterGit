import { TrashPanel } from "@/components/nav/TrashPanel";
import { cn } from "@/lib/utils";

/** Dedicated sidebar panel for soft-deleted sections, units, and assets. */
export function RemovedPanel({
  paperPath,
  refreshVersion,
  onNavigate,
  onModelChanged,
  onError,
  className,
}: {
  paperPath: string | null;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onModelChanged: () => void;
  onError: (message: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-y-auto", className)}>
      <TrashPanel
        paperPath={paperPath}
        refreshVersion={refreshVersion}
        onModelChanged={onModelChanged}
        onNavigate={onNavigate}
        onError={onError}
      />
    </div>
  );
}
