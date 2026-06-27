import { memo } from "react";

import { FigureCard } from "@/components/editor/FigureCard";

export const FigurePreviewPanel = memo(function FigurePreviewPanel({
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
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-card px-4 py-3">
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
});
