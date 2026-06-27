import type { AgentSessionFile } from "@/lib/agentDispatchClient";

export const STATUS_COLOR: Record<AgentSessionFile["status"], string> = {
  dispatched: "text-warning",
  complete: "text-success",
  skipped: "text-muted-foreground",
};

export function formatSessionAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function sessionActionLabel(action: string): string {
  return action.replace(/-/g, " ");
}

export function sessionStatusIcon(status: AgentSessionFile["status"]): string {
  if (status === "complete") return "✓";
  if (status === "skipped") return "—";
  return "⏳";
}

export type HistoryStatusFilter = "all" | AgentSessionFile["status"];

export function filterSessions(
  sessions: AgentSessionFile[],
  filter: HistoryStatusFilter,
): AgentSessionFile[] {
  if (filter === "all") return sessions;
  return sessions.filter((session) => session.status === filter);
}
