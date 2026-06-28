import { useCallback, useState } from "react";

import {
  loadWorkspacePreferences,
  mergeWorkspaceDefaults,
  scheduleSaveWorkspacePreferences,
} from "@/lib/workspacePreferences";

export function useReviewRailOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(
    () => mergeWorkspaceDefaults(loadWorkspacePreferences()).reviewRailOpen,
  );

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      scheduleSaveWorkspacePreferences({ reviewRailOpen: next });
      return next;
    });
  }, []);

  return [open, toggle];
}
