import { Bot, Clock } from "lucide-react";

import {
  formatSessionAt,
  sessionActionLabel,
  sessionStatusIcon,
  STATUS_COLOR,
} from "@/components/dispatch/dispatchHistoryUtils";
import type { AgentSessionFile } from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";

/** One-line summary for the collapsed bottom rail. */
export function DispatchHistoryStrip({
  sessions,
  currentPath,
  onOpenHistory,
}: {
  sessions: AgentSessionFile[];
  currentPath: string;
  onOpenHistory?: () => void;
}) {
  if (!currentPath) {
    return (
      <button
        type="button"
        className="dispatch-history-rail flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={onOpenHistory}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <span className="truncate">Open a unit to track AI dispatch history</span>
      </button>
    );
  }

  if (sessions.length === 0) {
    return (
      <button
        type="button"
        className="dispatch-history-rail flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={onOpenHistory}
      >
        <Bot className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <span className="truncate">No AI sessions yet for this unit</span>
      </button>
    );
  }

  const latest = sessions[0];

  return (
    <button
      type="button"
      title={latest.command}
      className="dispatch-history-rail flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={onOpenHistory}
    >
      <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <span className={cn("shrink-0 font-medium capitalize", STATUS_COLOR[latest.status])}>
        {sessionStatusIcon(latest.status)}
      </span>
      <span className="truncate capitalize">{sessionActionLabel(latest.action)}</span>
      <span className="shrink-0 opacity-50">·</span>
      <span className="max-w-[5rem] shrink-0 truncate">{latest.provider}</span>
      <span className="shrink-0 opacity-50">·</span>
      <span className="shrink-0 whitespace-nowrap">{formatSessionAt(latest.at)}</span>
      {sessions.length > 1 ? (
        <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          +{sessions.length - 1}
        </span>
      ) : null}
    </button>
  );
}
