import { WorkspaceModePill } from "@/components/layout/WorkspaceModePill";
import { SidebarPanelFooter } from "@/components/layout/SidebarPanelHeader";
import type { GitSyncState } from "@/lib/gitSync";

/** Sidebar panel shell: mode toggle, vertical nav column + content, status + utility footers. */
export function SidebarPanelChrome({
  explorerMode,
  onExplorerModeChange,
  gitSync,
  gitStatusLabel,
  connectionState,
  onGitClick,
  nav,
  utilityFooter,
  children,
}: {
  explorerMode: boolean;
  onExplorerModeChange: (explorer: boolean) => void;
  gitSync: GitSyncState | null;
  gitStatusLabel: string;
  connectionState: string;
  onGitClick: () => void;
  nav?: React.ReactNode;
  utilityFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="workspace-pane-header shrink-0 bg-[hsl(var(--sidebar-bg))]">
        <WorkspaceModePill explorerMode={explorerMode} onChange={onExplorerModeChange} className="h-7 w-full" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {nav || utilityFooter ? (
          <div className="flex w-9 shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-[hsl(var(--sidebar-bg))]">
            {nav}
            {utilityFooter}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <SidebarPanelFooter
        gitSync={gitSync}
        gitStatusLabel={gitStatusLabel}
        connectionState={connectionState}
        onGitClick={onGitClick}
      />
    </div>
  );
}
