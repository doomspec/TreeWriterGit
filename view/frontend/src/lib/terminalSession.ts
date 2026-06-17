const STORAGE_KEY = "treewriter.terminal.session.v1";

export function loadTerminalSessionId(): string | null {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export function saveTerminalSessionId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // quota or private mode — ignore
  }
}

export function clearTerminalSessionId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type TerminalConnectOptions = {
  sessionId?: string | null;
  forceNew?: boolean;
};

export function buildTerminalWebSocketUrl(baseUrl: string, options: TerminalConnectOptions = {}): string {
  const { sessionId = loadTerminalSessionId(), forceNew = false } = options;
  const url = new URL(baseUrl);
  if (sessionId) {
    url.searchParams.set("session", sessionId);
  }
  if (forceNew) {
    url.searchParams.set("new", "1");
  }
  return url.toString();
}

export function parseTerminalSessionMessage(data: string): string | null {
  if (!data.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(data) as { type?: string; id?: string };
    if (parsed.type === "session" && typeof parsed.id === "string" && parsed.id.trim()) {
      return parsed.id.trim();
    }
  } catch {
    return null;
  }
  return null;
}
