import { FigureCard } from "@/components/editor/FigureCard";
import type { NavigateTarget } from "@/lib/modelTree";

export function FigurePreviewPanel({
  unitPath,
  onNavigate,
}: {
  unitPath: string;
  refreshVersion?: number;
  onNavigate?: (target: NavigateTarget) => void;
}) {
  return (
    <div className="max-h-[40vh] shrink-0 overflow-auto border-t border-border bg-card px-4 py-3">
      <FigureCard targetPath={unitPath} onNavigate={onNavigate} />
    </div>
  );
}
