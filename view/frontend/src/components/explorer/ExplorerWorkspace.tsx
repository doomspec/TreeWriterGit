import { FileCode2 } from "lucide-react";

import { ExplorerFileTree } from "@/components/explorer/ExplorerFileTree";
import { ExplorerFileViewer } from "@/components/explorer/ExplorerFileViewer";
import { ExplorerSidebarRail } from "@/components/explorer/ExplorerSidebarRail";
import { ExplorerTabs } from "@/components/explorer/ExplorerTabs";
import { useTheme } from "@/lib/useTheme";
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";
import { useWorkspaceLayout } from "@/lib/workspace/WorkspaceLayoutContext";

/**
 * IDE-style Explorer workspace: a project-root file tree on the left, Chrome
 * tabs plus a CodeMirror editor on the right. Opens any text file type.
 */
export function ExplorerWorkspace() {
  const ws = useWorkspace();
  const layout = useWorkspaceLayout();
  const { preference: themePreference, cyclePreference } = useTheme();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      <ExplorerSidebarRail
        themePreference={themePreference}
        onCycleTheme={cyclePreference}
        appView={ws.appView}
        onSetAppView={ws.setAppView}
        aiPanelOpen={layout.aiPanelOpen}
        onToggleAiPanel={() => layout.setAiPanelOpen((open) => !open)}
      />
      <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        <ExplorerFileTree
          activeFile={ws.explorerActiveTab}
          onOpenFile={ws.openExplorerTab}
          onError={ws.setError}
          onPathChange={ws.applyExplorerPathChange}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ExplorerTabs
          tabs={ws.explorerOpenTabs}
          activeTab={ws.explorerActiveTab}
          onSelect={ws.setExplorerActiveTab}
          onClose={ws.closeExplorerTab}
        />
        {ws.explorerActiveTab ? (
          <ExplorerFileViewer
            key={ws.explorerActiveTab}
            path={ws.explorerActiveTab}
            onError={ws.setError}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileCode2 className="h-8 w-8 opacity-40" aria-hidden="true" />
            <p className="text-sm">Select a file from the Explorer to start editing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
