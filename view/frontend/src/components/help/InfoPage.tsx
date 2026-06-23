import { ArrowLeft, BookOpen, Command, Keyboard, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDefaultChord,
  HELP_FEATURES,
  HELP_SHORTCUT_GROUPS,
  paletteAltChordLabel,
  paletteChordLabel,
} from "@/lib/appHelpContent";

function InfoSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
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

export function InfoPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">TreeWriter guide</h1>
            <p className="text-xs text-muted-foreground">Features, command palette, and keyboard shortcuts</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <InfoSection title="Command palette" icon={Command}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {paletteChordLabel()}
              </kbd>{" "}
              or{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {paletteAltChordLabel()}
              </kbd>{" "}
              anywhere to open the palette. Fuzzy search covers labels, categories, and aliases (e.g.
              “focus”, “new note”, “terminal”).
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>↑↓ to navigate results, Enter to run, Esc to close</li>
              <li>Commands respect context — create actions only appear where they apply</li>
              <li>Open this guide from the header help button or search “guide” in the palette</li>
            </ul>
          </InfoSection>

          <InfoSection title="Default shortcuts" icon={Keyboard}>
            <p className="text-xs text-muted-foreground">
              ⌘ = Command on macOS, Ctrl on Windows/Linux. Customize under Settings → Keyboard shortcuts.
            </p>
            <div className="space-y-4">
              {HELP_SHORTCUT_GROUPS.map((group) => (
                <div key={group.category}>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.category}
                  </h3>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {group.shortcuts.map((shortcut) => (
                      <li
                        key={shortcut.chordId}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span>{shortcut.label}</span>
                        <kbd className="shrink-0 rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px]">
                          {formatDefaultChord(shortcut.chordId)}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </InfoSection>

          <InfoSection title="Features" icon={Sparkles}>
            <ul className="space-y-4">
              {HELP_FEATURES.map((feature) => (
                <li key={feature.title}>
                  <h3 className="text-sm font-medium">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection title="Quick start" icon={BookOpen}>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Open a paper under Papers and browse sections and units in the sidebar.</li>
              <li>Edit outline and draft in split view; approve draft changes to sync composed text.</li>
              <li>Use the graph to jump between linked notes; follow wikilinks in rendered markdown.</li>
              <li>Press ⌘⇧F for reading focus when you want a minimal writing surface.</li>
              <li>Press ⌘K whenever you forget a shortcut — the palette is the fastest route.</li>
            </ol>
          </InfoSection>
        </div>
      </div>
    </div>
  );
}
