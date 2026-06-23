import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { scoreCommand, type AppCommand } from "@/lib/commandPaletteTypes";
import { formatChord } from "@/lib/keyboardChords";
import { cn } from "@/lib/utils";

export function CommandPalette({
  open,
  commands,
  getChord,
  onExecute,
  onClose,
}: {
  open: boolean;
  commands: AppCommand[];
  getChord: (commandId: string) => string | undefined;
  onExecute: (commandId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = useMemo(
    () => commands.filter((command) => command.when?.() !== false),
    [commands],
  );

  const results = useMemo(() => {
    const scored = available
      .map((command) => ({ command, score: scoreCommand(query, command) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.command.label.localeCompare(b.command.label);
      });
    return scored.map((entry) => entry.command);
  }, [available, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, results.length]);

  if (!open) return null;

  return (
    <div className="command-palette-backdrop fixed inset-0 z-[100] flex items-start justify-center bg-overlay/50 px-4 pt-[min(18vh,8rem)] backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="command-palette relative z-[101] w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type a command…"
            aria-label="Search commands"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const command = results[activeIndex];
                if (command) {
                  onExecute(command.id);
                  onClose();
                }
              }
            }}
          />
        </div>
        <ul className="max-h-[min(50vh,24rem)] overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching commands</li>
          ) : (
            results.map((command, index) => {
              const chord = getChord(command.id);
              return (
                <li key={command.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                      index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onExecute(command.id);
                      onClose();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                    {command.category ? (
                      <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
                        {command.category}
                      </span>
                    ) : null}
                    {chord ? (
                      <kbd className="command-palette__shortcut shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatChord(chord)}
                      </kbd>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          ↑↓ navigate · Enter run · Esc close
        </div>
      </div>
    </div>
  );
}
