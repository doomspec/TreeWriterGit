import { request } from "@/lib/apiClient";
import type { BridgedProvider } from "@/lib/aiChat/providers";

/** Client for the bridged chat turn endpoint. Mirrors view/backend/src/aiChat/bridgedAdapters.ts. */
export type BridgedTurnResult = {
  text: string;
  sessionId: string | null;
};

export function runBridgedTurn(
  provider: BridgedProvider,
  prompt: string,
  sessionId: string | null,
  contextPaths?: string[],
  unitPath?: string,
  triggeredBy?: string,
): Promise<BridgedTurnResult> {
  return request<BridgedTurnResult>("/api/agent/chat-turn", {
    method: "POST",
    body: JSON.stringify({ provider, prompt, sessionId, contextPaths, unitPath, triggeredBy }),
  });
}
