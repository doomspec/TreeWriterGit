import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { ReadingFocusProvider } from "@/lib/readingFocus";
import { WorkspaceProvider } from "@/lib/workspace/WorkspaceProvider";

export function createWorkspaceWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ReadingFocusProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </ReadingFocusProvider>
    );
  };
}

export function renderWorkspaceHook<T>(callback: () => T) {
  return renderHook(callback, { wrapper: createWorkspaceWrapper() });
}
