import { useCallback, useState } from "react";

import { ConfirmDialog } from "@/components/ui/NamePromptDialog";
import { parentPath } from "@/lib/modelTree";
import { ApiError, deleteNode } from "@/modelApi";

type DeleteTarget = {
  path: string;
  label: string;
};

export function useDeleteNodeDialog({
  onChanged,
  onError,
  onDeleted,
}: {
  onChanged: () => void;
  onError: (message: string) => void;
  onDeleted?: (path: string) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [recursiveTarget, setRecursiveTarget] = useState<DeleteTarget | null>(null);

  const requestDelete = useCallback((path: string, label: string) => {
    setDeleteTarget({ path, label });
  }, []);

  const runDelete = useCallback(
    async (target: DeleteTarget, recursive: boolean) => {
      try {
        await deleteNode(target.path, recursive);
        onChanged();
        onDeleted?.(target.path);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [onChanged, onDeleted, onError],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteNode(target.path);
      onChanged();
      onDeleted?.(target.path);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRecursiveTarget(target);
        return;
      }
      onError(err instanceof Error ? err.message : String(err));
    }
  }, [deleteTarget, onChanged, onDeleted, onError]);

  const dialogs = (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete"
        message={deleteTarget ? `Delete ${deleteTarget.label}?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={recursiveTarget !== null}
        title="Delete folder and contents?"
        message={
          recursiveTarget
            ? `${recursiveTarget.label} is not empty. Delete it and everything inside?`
            : ""
        }
        confirmLabel="Delete all"
        destructive
        onConfirm={() => {
          if (!recursiveTarget) return;
          const target = recursiveTarget;
          setRecursiveTarget(null);
          void runDelete(target, true);
        }}
        onCancel={() => setRecursiveTarget(null)}
      />
    </>
  );

  return { requestDelete, dialogs };
}

/** Navigate away when the open folder or file was deleted. */
export function navigateAfterDelete(
  deletedPath: string,
  currentPath: string,
  onNavigate: (path: string) => void,
  activeFile?: string | null,
) {
  if (currentPath === deletedPath || currentPath.startsWith(`${deletedPath}/`)) {
    onNavigate(parentPath(deletedPath));
    return;
  }
  if (activeFile && (activeFile === deletedPath || activeFile.startsWith(`${deletedPath}/`))) {
    onNavigate(parentPath(deletedPath));
  }
}
