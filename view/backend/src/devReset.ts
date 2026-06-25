import { invalidateGraphCache } from "./graphCache.js";
import { resetModelIndexStores } from "./modelIndex/index.js";
import { invalidateModelTreeCache } from "./modelTreeCache.js";
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
  invalidateModelTreeCache();
  resetModelIndexStores();
  options?.terminalSessions?.resetAllSessions();
  return {
    graphCacheCleared: true,
    presenceCleared: true,
    modelEventsReset: true,
    terminalSessionsCleared: Boolean(options?.terminalSessions),
  };
}
