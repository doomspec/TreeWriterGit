import { request } from "@/lib/apiClient";

/**
 * Client for the repo-versioned chat session traces (plans/ai-assistant-panel.md,
 * Stage 3). Mirrors view/backend/src/chatSessions.ts.
 */

export type ChatMode = "pty" | "bridged";
export type ChatRole = "user" | "assistant";

export type ChatSessionMeta = {
  provider: string;
  mode: ChatMode;
  startedAt: string;
  unitPath: string;
  terminalSessionId?: string;
  agentSessionId?: string;
  contextFiles?: string[];
};

export type ChatTurn = {
  role: ChatRole;
  text: string;
  at: string;
};

export type ChatSessionFile = ChatSessionMeta & {
  id: string;
  filename: string;
  wikiPath: string;
  turns: ChatTurn[];
};

export type ChatSessionSummary = ChatSessionMeta & {
  id: string;
  filename: string;
  wikiPath: string;
  turnCount: number;
  lastAt: string | null;
};

export function createChatSession(
  unitPath: string,
  options: {
    provider: string;
    mode: ChatMode;
    terminalSessionId?: string;
    agentSessionId?: string;
    contextFiles?: string[];
  },
): Promise<ChatSessionFile> {
  return request<ChatSessionFile>("/api/sessions/chat", {
    method: "POST",
    body: JSON.stringify({ unitPath, ...options }),
  });
}

/** Union new context file paths into a session's trace frontmatter (Stage 5). */
export function addChatSessionContextFiles(
  unitPath: string,
  filename: string,
  contextFiles: string[],
): Promise<{ ok: true; contextFiles: string[] }> {
  return request<{ ok: true; contextFiles: string[] }>("/api/sessions/chat/context", {
    method: "POST",
    body: JSON.stringify({ unitPath, filename, contextFiles }),
  });
}

export function appendChatTurn(
  unitPath: string,
  filename: string,
  turn: ChatTurn,
): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/sessions/chat/append", {
    method: "POST",
    body: JSON.stringify({ unitPath, filename, turn }),
  });
}

export async function listChatSessions(unitPath: string): Promise<ChatSessionSummary[]> {
  const data = await request<{ sessions: ChatSessionSummary[] }>(
    `/api/sessions/chat?unitPath=${encodeURIComponent(unitPath)}`,
  );
  return data.sessions;
}

export function readChatSession(unitPath: string, filename: string): Promise<ChatSessionFile> {
  return request<ChatSessionFile>(
    `/api/sessions/chat/read?unitPath=${encodeURIComponent(unitPath)}&filename=${encodeURIComponent(filename)}`,
  );
}
