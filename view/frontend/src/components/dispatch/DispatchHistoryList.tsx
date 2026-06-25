import { useMemo, useState } from "react";
import { Bot, Check, Clock, Copy, X } from "lucide-react";

import {
  filterSessions,
  formatSessionAt,
  sessionActionLabel,
  sessionStatusIcon,
  STATUS_COLOR,
  type HistoryStatusFilter,
} from "@/components/dispatch/dispatchHistoryUtils";
import { Button } from "@/components/ui/button";
import type { AgentSessionFile } from "@/lib/agentDispatchClient";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS: { value: HistoryStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dispatched", label: "Dispatched" },
  { value: "complete", label: "Complete" },
  { value: "skipped", label: "Skipped" },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function DispatchHistoryList({
  sessions,
  currentPath,
  selectedFilename,
  onSelect,
  onMarkStatus,
}: {
  sessions: AgentSessionFile[];
  currentPath: string;
  selectedFilename?: string | null;
  onSelect?: (session: AgentSessionFile | null) => void;
  onMarkStatus?: (session: AgentSessionFile, status: AgentSessionFile["status"]) => void;
}) {
  const [filter, setFilter] = useState<HistoryStatusFilter>("all");
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);

  const filtered = useMemo(() => filterSessions(sessions, filter), [filter, sessions]);

  if (!currentPath) {
    return (
      <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>Open a unit to track AI dispatch history</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        <Bot className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>No AI sessions yet for this unit</span>
      </div>
    );
  }

  return (
    <div className="dispatch-history-list flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/70 px-3 py-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors",
              filter === option.value
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {filtered.length} session{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2" role="list">
        {filtered.length === 0 ? (
          <li className="px-2 py-6 text-center text-xs text-muted-foreground">
            No sessions match this filter.
          </li>
        ) : (
          filtered.map((session) => {
            const expanded = session.filename === selectedFilename;
            return (
              <li key={session.filename} className="dispatch-history-list__item">
                <button
                  type="button"
                  title={session.command}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-[11px] transition-colors",
                    expanded
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-accent/30",
                  )}
                  onClick={() => onSelect?.(expanded ? null : session)}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 font-medium capitalize",
                      STATUS_COLOR[session.status],
                    )}
                  >
                    {sessionStatusIcon(session.status)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="font-medium capitalize text-foreground">
                        {sessionActionLabel(session.action)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{session.provider}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatSessionAt(session.at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {session.unitPath && session.unitPath !== currentPath
                        ? session.unitPath
                        : currentPath}
                    </span>
                  </span>
                </button>

                {expanded ? (
                  <div className="mb-2 ml-6 mr-1 rounded-md border border-border/70 bg-muted/10 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-medium text-muted-foreground">Command</p>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Copy command"
                          aria-label="Copy command"
                          onClick={() => {
                            void copyText(session.command).then((ok) => {
                              if (!ok) return;
                              setCopiedFilename(session.filename);
                              window.setTimeout(() => setCopiedFilename(null), 2000);
                            });
                          }}
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        {session.status === "dispatched" && onMarkStatus ? (
                          <>
                            <button
                              type="button"
                              title="Mark complete"
                              className="rounded-sm border border-border bg-background p-1 hover:bg-accent"
                              onClick={() => onMarkStatus(session, "complete")}
                            >
                              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              title="Mark skipped"
                              className="rounded-sm border border-border bg-background p-1 hover:bg-accent"
                              onClick={() => onMarkStatus(session, "skipped")}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {copiedFilename === session.filename ? (
                      <p className="mb-1 text-[10px] text-success">Copied to clipboard</p>
                    ) : null}
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-[10px] leading-relaxed">
                      {session.command}
                    </pre>
                    {session.wikiPath ? (
                      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                        Log: {session.wikiPath}
                      </p>
                    ) : null}
                    {session.status === "dispatched" ? (
                      <p className="mt-1.5 text-[10px] text-warning">
                        Session dispatched — mark complete once the agent finishes.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
