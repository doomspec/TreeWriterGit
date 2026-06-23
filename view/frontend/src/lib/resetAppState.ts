const LOCAL_STORAGE_KEYS = [
  "treewriter.workspace.v1",
  "treewriter.editorSession.v1",
  "treewriter.terminal.session.v1",
  "treewriter.dispatch-jobs",
  "treewriter.readingFocus.v1",
  "treewriter.readingFocus.graphVisible.v1",
  "treewriter.readingTypography.v1",
  "treewriter.editorTextZoom.v2",
  "treewriter.theme.v1",
  "treewriter.lastAgentProvider.v1",
  "treewriter.keyboardBindings.v1",
  "treewriter.userName",
  "treewriter.githubHandle",
] as const;

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

/** Remove all TreeWriter keys from browser localStorage. */
export function clearLocalAppState(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // private mode / quota
    }
  }

  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("treewriter.")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

/** Clear in-memory server caches (graph, presence, model-event dedupe). */
export async function resetServerMemoryState(): Promise<void> {
  const response = await fetch(`${apiBase}/api/dev/reset`, { method: "POST" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Server reset failed (${response.status})`);
  }
}

/** Clear browser + server state, then reload the page. */
export async function resetAppState(reload = true): Promise<void> {
  clearLocalAppState();
  await resetServerMemoryState();
  if (reload) {
    window.location.reload();
  }
}
