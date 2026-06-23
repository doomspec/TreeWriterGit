import { useEffect } from "react";

let dirtyEditorCount = 0;

export function isAnyEditorDirty(): boolean {
  return dirtyEditorCount > 0;
}

/** Call from markdown editors when local content differs from saved server copy. */
export function useEditorDirty(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    dirtyEditorCount += 1;
    return () => {
      dirtyEditorCount -= 1;
    };
  }, [isDirty]);
}
