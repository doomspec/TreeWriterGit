import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { parentPath } from "@/lib/modelTree";
import { archiveNode as archiveModelNode } from "@/modelApi";

type ArchiveTarget = {
  path: string;
  label: string;
};

export function useArchiveNodeDialog({
  onChanged,
  onError,
  onArchived,
}: {
  onChanged: () => void;
  onError: (message: string) => void;
  onArchived?: (path: string) => void;
}) {
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  const requestArchive = useCallback((path: string, label: string) => {
    setArchiveTarget({ path, label });
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      await archiveModelNode(target.path);
      onChanged();
      onArchived?.(target.path);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }, [archiveTarget, onArchived, onChanged, onError]);

  const dialogs = (
    <ConfirmDialog
      open={archiveTarget !== null}
      title="Move to Removed"
      message={
        archiveTarget
          ? `Move ${archiveTarget.label} to Removed? You can restore or permanently delete it from the Removed section.`
          : ""
      }
      confirmLabel="Move to Removed"
      destructive
      onConfirm={() => void handleArchiveConfirm()}
      onCancel={() => setArchiveTarget(null)}
    />
  );

  return { requestArchive, dialogs };
}

/** Navigate away when the open folder or file was archived. */
export function navigateAfterArchive(
  archivedPath: string,
  currentPath: string,
  onNavigate: (path: string) => void,
  activeFile?: string | null,
) {
  if (currentPath === archivedPath || currentPath.startsWith(`${archivedPath}/`)) {
    onNavigate(parentPath(archivedPath));
    return;
  }
  if (activeFile && (activeFile === archivedPath || activeFile.startsWith(`${archivedPath}/`))) {
    onNavigate(parentPath(archivedPath));
  }
}
