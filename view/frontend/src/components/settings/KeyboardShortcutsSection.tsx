import { useEffect, useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/lib/CommandPaletteProvider";
import { chordFromKeyboardEvent, formatChord } from "@/lib/keyboardChords";

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Keyboard;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </section>
  );
}

export function KeyboardShortcutsSection() {
  const { commands, getChord, setBinding, resetBindings, allDefaultChords } = useCommandPalette();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecordingId(null);
        return;
      }
      const chord = chordFromKeyboardEvent(event);
      if (!chord) return;
      setBinding(recordingId, chord);
      setRecordingId(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recordingId, setBinding]);

  const sorted = [...commands].sort((a, b) => {
    const cat = (a.category ?? "Other").localeCompare(b.category ?? "Other");
    if (cat !== 0) return cat;
    return a.label.localeCompare(b.label);
  });

  const grouped = sorted.reduce<Record<string, typeof sorted>>((acc, command) => {
    const key = command.category ?? "Other";
    acc[key] = acc[key] ?? [];
    acc[key].push(command);
    return acc;
  }, {});

  return (
    <SettingsSection title="Keyboard shortcuts" icon={Keyboard}>
      <p className="text-xs text-muted-foreground">
        Tangent-style keyboard control — press{" "}
        <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
          {formatChord(allDefaultChords["palette.open"] ?? "Mod+K")}
        </kbd>{" "}
        anywhere to open the command palette. Click a shortcut to rebind; press Esc to cancel.
      </p>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={resetBindings}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((command) => {
                const chord = getChord(command.id);
                const isRecording = recordingId === command.id;
                return (
                  <li key={command.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-sm">{command.label}</span>
                    <button
                      type="button"
                      className="keyboard-shortcut-rebind shrink-0 rounded border border-border bg-muted/50 px-2 py-1 font-mono text-[10px] hover:bg-accent"
                      onClick={() => setRecordingId(isRecording ? null : command.id)}
                    >
                      {isRecording ? "Press keys…" : chord ? formatChord(chord) : "—"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
