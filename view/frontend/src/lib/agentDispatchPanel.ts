import { createContext, useContext } from "react";

import type { AgentDispatchAction } from "@/lib/agentDispatchClient";

export type AgentDispatchIntent = {
  action: AgentDispatchAction;
  pane?: "outline" | "draft";
  /** Generate a command preview when the panel opens. */
  autoPreview?: boolean;
};

export type AgentDispatchPanelContextValue = {
  openDispatch: (intent: AgentDispatchIntent) => void;
};

export const AgentDispatchPanelContext = createContext<AgentDispatchPanelContextValue | null>(
  null,
);

export function useAgentDispatchPanel(): AgentDispatchPanelContextValue {
  const ctx = useContext(AgentDispatchPanelContext);
  if (!ctx) {
    throw new Error("useAgentDispatchPanel must be used within AgentDispatchPanelContext");
  }
  return ctx;
}

export function useAgentDispatchPanelOptional(): AgentDispatchPanelContextValue | null {
  return useContext(AgentDispatchPanelContext);
}
