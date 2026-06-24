import { exportModularPaper } from "./exportModular.js";
import type { ExportConfig } from "./exportConfig.js";
import { getOverleafStatus, pushToOverleaf } from "./overleaf.js";

export function paperSlugFromModelPath(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^papers\/([^/]+)\//);
  return match?.[1] ?? null;
}

/** Manuscript edits that should trigger a debounced export. */
export function shouldAutoExportPath(relativePath: string | null | undefined): boolean {
  if (!relativePath) return false;
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith("papers/")) return false;
  if (normalized.includes("/notes/")) return false;
  return (
    normalized.endsWith("/draft.md") ||
    normalized.endsWith("/outline.md") ||
    normalized.endsWith("/draft.approved.md")
  );
}

export function createAutoExportRunner(options: {
  modelRoot: string;
  repoRoot: string;
  getExportConfig: () => Promise<ExportConfig>;
  state?: {
    running: boolean;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastPaperSlug: string | null;
    lastMessage: string | null;
  };
}) {
  const state = options.state ?? {
    running: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastPaperSlug: null,
    lastMessage: null,
  };
  const pendingByPaper = new Map<string, NodeJS.Timeout>();

  const runForPaper = async (paperSlug: string): Promise<void> => {
    const config = await options.getExportConfig();
    state.lastRunAt = new Date().toISOString();
    state.lastPaperSlug = paperSlug;
    state.running = true;
    state.lastError = null;

    try {
      const messages: string[] = [];
      const exportArgs = {
        paperSlug,
        includeDrafts: config.includeDrafts,
      };

      if (config.pushOverleaf) {
        const overleaf = await getOverleafStatus(options.modelRoot, paperSlug);
        if (overleaf.connected) {
          const push = await pushToOverleaf(
            options.modelRoot,
            options.repoRoot,
            paperSlug,
            config.includeDrafts,
          );
          messages.push(push.message);
        } else {
          await exportModularPaper(options.modelRoot, options.repoRoot, exportArgs);
          messages.push("Exported modular LaTeX bundle");
          messages.push("Overleaf not connected — skipped push");
        }
      } else {
        await exportModularPaper(options.modelRoot, options.repoRoot, exportArgs);
        messages.push("Exported modular LaTeX bundle");
      }

      state.lastSuccessAt = new Date().toISOString();
      state.lastMessage = messages.join(" · ");
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      state.lastMessage = null;
      throw error;
    } finally {
      state.running = false;
    }
  };

  const scheduleAutoExport = (relativePath: string | null | undefined): void => {
    void (async () => {
      if (!shouldAutoExportPath(relativePath)) return;
      const paperSlug = paperSlugFromModelPath(relativePath);
      if (!paperSlug) return;

      const config = await options.getExportConfig();
      if (!config.autoExport) return;

      const existing = pendingByPaper.get(paperSlug);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        pendingByPaper.delete(paperSlug);
        void runForPaper(paperSlug).catch(() => {
          // error recorded in state
        });
      }, config.debounceMs);
      pendingByPaper.set(paperSlug, timer);
    })();
  };

  const runAutoExportNow = async (paperSlug?: string): Promise<void> => {
    if (paperSlug?.trim()) {
      await runForPaper(paperSlug.trim());
      return;
    }
    throw new Error("paperSlug is required");
  };

  const dispose = (): void => {
    for (const timer of pendingByPaper.values()) {
      clearTimeout(timer);
    }
    pendingByPaper.clear();
  };

  return {
    state,
    scheduleAutoExport,
    runAutoExportNow,
    dispose,
  };
}
