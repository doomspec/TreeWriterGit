import { AiAssistantPanel } from "@/components/assistant/AiAssistantPanel";
import type { AgentDispatchAction } from "@/lib/agentDispatchClient";

export type AiAssistantPanelHostProps = {
  onClose: () => void;
  currentPath: string;
  refreshVersion: number;
  isUnit?: boolean;
  canFanOut?: boolean;
  onSendToTerminal: (command: string) => void;
  onError: (message: string) => void;
  onReconnect: () => void;
  onLayoutChange?: () => void;
  terminalHostRef: React.Ref<HTMLDivElement | null>;
  connectionState: string;
  terminalOpen: boolean;
  onTerminalOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  subscribeOutput: (listener: (chunk: string) => void) => () => void;
  getTerminalSessionId: () => string | null;
  getLastInputLine: () => string;
  skillsOpen: boolean;
  onSkillsOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  onEditSkill: (filename: string) => void;
  onOpenFile?: (path: string) => void;
  onNavigateToUnit?: (path: string) => void;
  requestedHistoryOpenAt?: number;
  requestedDispatchAction?: { action: AgentDispatchAction } | null;
};

/** Shared AI assistant panel wiring for writer and explorer shells. */
export function AiAssistantPanelHost(props: AiAssistantPanelHostProps) {
  return <AiAssistantPanel {...props} />;
}
