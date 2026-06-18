import { useState } from "react";
import { Plus } from "lucide-react";

import { PaperSelect, paperSlugFromPath } from "@/components/nav/PaperSelect";
import { Button } from "@/components/ui/button";
import { usePaperList } from "@/lib/usePaperList";
import type { ModelNode } from "@/lib/modelTree";
import { NewPaperModal } from "@/components/paper/NewPaperModal";

export function PaperSelectorBar({
  tree,
  currentPath,
  refreshVersion,
  onNavigate,
  onPaperCreated,
  onError,
}: {
  tree: ModelNode[];
  currentPath: string;
  refreshVersion: number;
  onNavigate: (path: string) => void;
  onPaperCreated: (path: string) => void;
  onError: (message: string) => void;
}) {
  const { papers, loading } = usePaperList(tree, refreshVersion, onError);
  const [showNewPaper, setShowNewPaper] = useState(false);
  const selectedSlug = paperSlugFromPath(currentPath);

  const handlePaperChange = (slug: string) => {
    if (!slug) {
      onNavigate("papers");
      return;
    }
    onNavigate(`papers/${slug}`);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <PaperSelect
          papers={papers}
          selectedSlug={selectedSlug}
          loading={loading}
          className="min-w-0 flex-1"
          onChange={handlePaperChange}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="New paper"
          aria-label="New paper"
          onClick={() => setShowNewPaper(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {showNewPaper ? (
        <NewPaperModal
          onClose={() => setShowNewPaper(false)}
          onCreated={(path) => {
            setShowNewPaper(false);
            onPaperCreated(path);
          }}
          onError={onError}
        />
      ) : null}
    </>
  );
}
