import { FigureCard } from "@/components/editor/FigureCard";

export function FigurePreviewPanel({
  unitPath,
  refreshVersion,
  liveCaption,
  embeddedInEditor = false,
  onModelChanged,
  onError,
}: {
  unitPath: string;
  refreshVersion?: number;
  liveCaption?: string | null;
  embeddedInEditor?: boolean;
  onModelChanged?: () => void;
  onError?: (message: string) => void;
}) {
  return (
    <div className="max-h-[40vh] shrink-0 overflow-auto border-t border-border bg-card px-4 py-3">
      <FigureCard
        targetPath={unitPath}
        refreshVersion={refreshVersion}
        liveCaption={liveCaption}
        embeddedInEditor={embeddedInEditor}
        onModelChanged={onModelChanged}
        onError={onError}
      />
    </div>
  );
}
