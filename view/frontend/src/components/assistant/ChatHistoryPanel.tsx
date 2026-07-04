import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, MessageSquare, Paperclip, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatBubble } from "@/components/assistant/AiChatThread";
import { formatSessionAt } from "@/components/dispatch/dispatchHistoryUtils";
import { shortPathLabel } from "@/lib/shortPathLabel";
import {
  listChatSessions,
  readChatSession,
  type ChatSessionFile,
  type ChatSessionSummary,
} from "@/lib/aiChat/sessionClient";

/**
 * Read-only browser for past chat sessions of the current paper
 * (plans/ai-assistant-panel.md, Stage 7). Lists trace summaries, then loads
 * and renders a picked session's turns with the same bubble styling as the
 * live thread. Bridged sessions can be continued into the live chat.
 */
export function ChatHistoryPanel({
  paperPath,
  unitPath,
  onClose,
  onError,
  onOpenFile,
  onResumeSession,
}: {
  /** Paper root path — list reloads when this changes. */
  paperPath: string;
  /** Any path under the paper — used for API validation. */
  unitPath: string;
  onClose: () => void;
  onError: (message: string) => void;
  onOpenFile?: (path: string) => void;
  onResumeSession?: (session: ChatSessionFile) => void;
}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null);
  const [selected, setSelected] = useState<ChatSessionFile | null>(null);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSessions(null);
    setSelected(null);
    if (!paperPath) {
      setSessions([]);
      return;
    }
    void listChatSessions(unitPath)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setSessions([]);
          onError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperPath, unitPath]);

  const openSession = async (summary: ChatSessionSummary) => {
    setLoadingFilename(summary.filename);
    try {
      const full = await readChatSession(unitPath, summary.filename);
      setSelected(full);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFilename(null);
    }
  };

  const handleContinue = () => {
    if (!selected || !onResumeSession) return;
    onResumeSession(selected);
    onClose();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        {selected ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Back to session list"
            aria-label="Back to session list"
            onClick={() => setSelected(null)}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {selected
            ? `${selected.provider} · ${formatSessionAt(selected.startedAt)}`
            : "Session history"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Close history"
          aria-label="Close history"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {selected ? (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
            <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={selected.unitPath}>
              {shortPathLabel(selected.unitPath)}
            </p>
            {selected.mode === "bridged" && selected.turns.length > 0 && onResumeSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 shrink-0 gap-1 px-2 text-[10px]"
                onClick={handleContinue}
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                Continue
              </Button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-2">
            {selected.contextFiles?.length ? (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                {selected.contextFiles.join(", ")}
              </p>
            ) : null}
            {selected.turns.length === 0 ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">No turns recorded.</p>
            ) : (
              selected.turns.map((turn, index) => (
                <ChatBubble
                  key={index}
                  turn={turn}
                  currentPath={selected.unitPath}
                  onOpenFile={onOpenFile}
                />
              ))
            )}
          </div>
        </>
      ) : sessions === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          No past sessions for this paper yet.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5" role="list">
          {sessions.map((session) => (
            <li key={session.filename}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-accent/40"
                onClick={() => void openSession(session)}
              >
                {loadingFilename === session.filename ? (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    <span className="font-medium capitalize text-foreground">{session.provider}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{session.mode}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatSessionAt(session.startedAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground" title={session.unitPath}>
                    {shortPathLabel(session.unitPath)}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {session.turnCount} turn{session.turnCount === 1 ? "" : "s"}
                    {session.contextFiles?.length
                      ? ` · ${session.contextFiles.length} file${session.contextFiles.length === 1 ? "" : "s"} attached`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
