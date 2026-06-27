import { Bot, Clock, Info, Sparkles } from "lucide-react";

import { DispatchHistoryList } from "@/components/dispatch/DispatchHistoryList";
import { DispatchIntegrationPanel } from "@/components/dispatch/DispatchIntegrationPanel";
import { DispatchPanel } from "@/components/dispatch/DispatchPanel";
import { DispatchSkillsPanel } from "@/components/dispatch/DispatchSkillsPanel";
import type { AgentDispatchIntent } from "@/lib/agentDispatchPanel";
import type { AgentSessionFile } from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";

export type DispatchPaneTab = "run" | "history" | "integration" | "skills";

const DISPATCH_TABS: {
  id: DispatchPaneTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "run", label: "Dispatch", icon: Bot },
  { id: "history", label: "History", icon: Clock },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "integration", label: "Integration", icon: Info },
];

export function DispatchWorkspace({
  activeTab,
  onTabChange,
  currentPath,
  refreshVersion,
  isUnit,
  canFanOut,
  dispatchIntent,
  onDispatchIntentConsumed,
  onSendToTerminal,
  onError,
  onLayoutChange,
  onPreviewChange,
  onSessionsReload,
  sessions,
  selectedSessionFilename,
  onSelectSession,
  onMarkStatus,
  previewPrompt,
  previewCommand,
  skillsVersion,
  onSkillsChanged,
}: {
  activeTab: DispatchPaneTab;
  onTabChange: (tab: DispatchPaneTab) => void;
  currentPath: string;
  refreshVersion: number;
  isUnit: boolean;
  canFanOut: boolean;
  dispatchIntent?: AgentDispatchIntent | null;
  onDispatchIntentConsumed?: () => void;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onLayoutChange?: () => void;
  onPreviewChange?: (preview: { prompt: string; command: string } | null) => void;
  onSessionsReload?: () => void | Promise<void>;
  sessions: AgentSessionFile[];
  selectedSessionFilename?: string | null;
  onSelectSession?: (session: AgentSessionFile | null) => void;
  onMarkStatus?: (session: AgentSessionFile, status: AgentSessionFile["status"]) => void;
  previewPrompt?: string | null;
  previewCommand?: string | null;
  skillsVersion?: number;
  onSkillsChanged?: () => void;
}) {
  return (
    <div className="dispatch-workspace flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className="dispatch-pane-tabs flex shrink-0 items-center gap-0.5 px-2"
        role="tablist"
        aria-label="AI dispatch"
      >
        {DISPATCH_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              activeTab === id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => onTabChange(id)}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col overflow-y-auto overflow-x-hidden",
            activeTab !== "run" && "pointer-events-none invisible",
          )}
          role="tabpanel"
          aria-hidden={activeTab !== "run"}
        >
          <DispatchPanel
            embedded
            currentPath={currentPath}
            refreshVersion={refreshVersion}
            isUnit={isUnit}
            canFanOut={canFanOut}
            dispatchIntent={dispatchIntent}
            onDispatchIntentConsumed={onDispatchIntentConsumed}
            onSendToTerminal={onSendToTerminal}
            onError={onError}
            onToggle={() => window.requestAnimationFrame(() => onLayoutChange?.())}
            onPreviewChange={onPreviewChange}
            onSessionsReload={onSessionsReload}
            skillsVersion={skillsVersion}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col",
            activeTab !== "history" && "pointer-events-none invisible",
          )}
          role="tabpanel"
          aria-hidden={activeTab !== "history"}
        >
          <DispatchHistoryList
            sessions={sessions}
            currentPath={currentPath}
            selectedFilename={selectedSessionFilename}
            onSelect={onSelectSession}
            onMarkStatus={onMarkStatus}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col",
            activeTab !== "skills" && "pointer-events-none invisible",
          )}
          role="tabpanel"
          aria-hidden={activeTab !== "skills"}
        >
          <DispatchSkillsPanel onError={onError} onSkillsChanged={onSkillsChanged} />
        </div>

        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col",
            activeTab !== "integration" && "pointer-events-none invisible",
          )}
          role="tabpanel"
          aria-hidden={activeTab !== "integration"}
        >
          <DispatchIntegrationPanel
            currentPath={currentPath}
            previewPrompt={previewPrompt}
            previewCommand={previewCommand}
          />
        </div>
      </div>
    </div>
  );
}
