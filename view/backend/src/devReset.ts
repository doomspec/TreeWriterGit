import { invalidateGraphCache } from "./graphCache.js";
import { resetModelEventBroadcastState } from "./modelEvents.js";
import { resetPresenceState } from "./presence.js";
import type { TerminalSessionManager } from "./terminalSessions.js";

export function resetServerMemoryState(options?: {
  terminalSessions?: TerminalSessionManager;
}): {
  graphCacheCleared: boolean;
  presenceCleared: boolean;
  modelEventsReset: boolean;
  terminalSessionsCleared: boolean;
} {
  resetModelEventBroadcastState();
  resetPresenceState();
  invalidateGraphCache();
  options?.terminalSessions?.resetAllSessions();
  return {
    graphCacheCleared: true,
    presenceCleared: true,
    modelEventsReset: true,
    terminalSessionsCleared: Boolean(options?.terminalSessions),
  };
}
