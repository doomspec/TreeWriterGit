import { useCallback, useState } from "react";

import { ConfirmDialog, NamePromptDialog } from "@/components/ui/NamePromptDialog";
import {
  explorerFolderIndexContent,
  explorerFolderOutlineContent,
} from "@/lib/explorerFolderSkeleton";
import { parentPath } from "@/lib/modelTree";
import { navigateAfterDelete, useDeleteNodeDialog } from "@/lib/useDeleteNodeDialog";
import { ApiError, createFile, moveNode } from "@/modelApi";

export type ExplorerTreeTarget = {
  path: string;
  kind: "file" | "directory";
  label: string;
};

function renameDefaultValue(target: ExplorerTreeTarget): string {
  const base = target.path.split("/").pop() ?? target.label;
  if (target.kind === "file") {
    return base.replace(/\.md$/i, "");
  }
  return base;
}

function buildRenameDestination(target: ExplorerTreeTarget, nextName: string): string {
  const parent = parentPath(target.path);
  if (target.kind === "file") {
    const fileName = nextName.toLowerCase().endsWith(".md") ? nextName : `${nextName}.md`;
    return parent ? `${parent}/${fileName}` : fileName;
  }
  return parent ? `${parent}/${nextName}` : nextName;
}

export function useExplorerTreeMutations({
  onChanged,
  onError,
  onDeleted,
  onCreatedFile,
}: {
  onChanged: () => void;
  onError: (message: string) => void;
  onDeleted?: (path: string) => void;
  onCreatedFile?: (path: string) => void;
}) {
  const [createPrompt, setCreatePrompt] = useState<{ parentPath: string; kind: "file" | "folder" } | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<ExplorerTreeTarget | null>(null);

  const { requestDelete, dialogs: deleteDialogs } = useDeleteNodeDialog({
    onChanged,
    onError,
    onDeleted,
  });

  const promptCreateFile = useCallback((parentPath: string) => {
    setCreatePrompt({ parentPath, kind: "file" });
  }, []);

  const promptCreateFolder = useCallback((parentPath: string) => {
    setCreatePrompt({ parentPath, kind: "folder" });
  }, []);

  const promptRename = useCallback((target: ExplorerTreeTarget) => {
    setRenameTarget(target);
  }, []);

  const submitCreate = useCallback(
    async (name: string) => {
      if (!createPrompt) return;
      const { parentPath: parent, kind } = createPrompt;
      setCreatePrompt(null);
      try {
        if (kind === "file") {
          const filePath = parent ? `${parent}/${name}.md` : `${name}.md`;
          await createFile(filePath, "");
          onChanged();
          onCreatedFile?.(filePath);
          return;
        }
        const folderPath = parent ? `${parent}/${name}` : name;
        await createFile(`${folderPath}/INDEX.md`, explorerFolderIndexContent(name));
        await createFile(`${folderPath}/outline.md`, explorerFolderOutlineContent(name));
        onChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [createPrompt, onChanged, onCreatedFile, onError],
  );

  const submitRename = useCallback(
    async (nextName: string) => {
      if (!renameTarget) return;
      const target = renameTarget;
      setRenameTarget(null);
      const current = renameDefaultValue(target);
      if (nextName === current) return;
      const to = buildRenameDestination(target, nextName);
      try {
        await moveNode(target.path, to);
        onChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      }
    },
    [onChanged, onError, renameTarget],
  );

  const dialogs = (
    <>
      <NamePromptDialog
        open={createPrompt?.kind === "file"}
        title="New file"
        label="File name (without .md)"
        confirmLabel="Create"
        onConfirm={(value) => void submitCreate(value)}
        onCancel={() => setCreatePrompt(null)}
      />
      <NamePromptDialog
        open={createPrompt?.kind === "folder"}
        title="New folder"
        label="Folder name"
        confirmLabel="Create"
        onConfirm={(value) => void submitCreate(value)}
        onCancel={() => setCreatePrompt(null)}
      />
      <NamePromptDialog
        open={renameTarget !== null}
        title="Rename"
        label={renameTarget?.kind === "file" ? "File name (without .md)" : "Folder name"}
        defaultValue={renameTarget ? renameDefaultValue(renameTarget) : ""}
        confirmLabel="Rename"
        onConfirm={(value) => void submitRename(value)}
        onCancel={() => setRenameTarget(null)}
      />
      {deleteDialogs}
    </>
  );

  return {
    promptCreateFile,
    promptCreateFolder,
    promptRename,
    promptDelete: requestDelete,
    dialogs,
  };
}

/** Navigate browse path and close explorer tabs after a deleted node. */
export function handleExplorerNodeDeleted(
  deletedPath: string,
  browsePath: string,
  activeFile: string | null,
  navigateTo: (path: string) => void,
  closeEditorTab: (path: string) => void,
): void {
  navigateAfterDelete(deletedPath, browsePath, navigateTo, activeFile);
  if (activeFile && (activeFile === deletedPath || activeFile.startsWith(`${deletedPath}/`))) {
    closeEditorTab(activeFile);
  }
}

export { ApiError };
