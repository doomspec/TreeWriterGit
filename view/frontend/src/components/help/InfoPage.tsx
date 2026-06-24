import { ArrowLeft, BookOpen, ChevronRight, Command, Download, Keyboard, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDefaultChord,
  HELP_FEATURES,
  HELP_OVERLEAF,
  HELP_QUICK_START,
  HELP_SHORTCUT_GROUPS,
  paletteAltChordLabel,
  paletteChordLabel,
} from "@/lib/appHelpContent";
import { cn } from "@/lib/utils";

function InfoExpandableSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group/info-section rounded-lg border border-border bg-card shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-transparent px-4 py-3 group-open/info-section:border-border [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/info-section:rotate-90"
          aria-hidden="true"
        />
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">{title}</h2>
      </summary>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </details>
  );
}

function InfoFeatureItem({
  title,
  body,
  hints,
}: {
  title: string;
  body: string;
  hints?: readonly string[];
}) {
  return (
    <details className="group/feature rounded-md border border-border/70 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/feature:rotate-90"
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{title}</span>
      </summary>
      <div className="space-y-2 border-t border-border/70 px-3 py-2.5">
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        {hints?.length ? (
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
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
            <p className="text-xs text-muted-foreground">
              Features, Overleaf sync, command palette, and keyboard shortcuts
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <InfoExpandableSection title="Quick start" icon={BookOpen} defaultOpen>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {HELP_QUICK_START.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </InfoExpandableSection>

          <InfoExpandableSection title="Features" icon={Sparkles} defaultOpen>
            <p className="text-sm text-muted-foreground">
              Expand a topic for details and tips. Newer workflow pieces are listed first.
            </p>
            <div className="space-y-2">
              {HELP_FEATURES.map((feature) => (
                <InfoFeatureItem
                  key={feature.title}
                  title={feature.title}
                  body={feature.body}
                  hints={feature.hints}
                />
              ))}
            </div>
          </InfoExpandableSection>

          <InfoExpandableSection title="Overleaf integration" icon={Download} defaultOpen>
            <p className="text-sm leading-relaxed text-muted-foreground">{HELP_OVERLEAF.intro}</p>
            <div className="space-y-2">
              {HELP_OVERLEAF.steps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Hints
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                {HELP_OVERLEAF.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          </InfoExpandableSection>

          <InfoExpandableSection title="Command palette" icon={Command}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Press <Kbd>{paletteChordLabel()}</Kbd> or <Kbd>{paletteAltChordLabel()}</Kbd> anywhere
              to open the palette. Fuzzy search covers labels, categories, and aliases (e.g. “focus”,
              “export”, “overleaf”, “terminal”).
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>↑↓ to navigate results, Enter to run, Esc to close</li>
              <li>Commands respect context — create actions only appear where they apply</li>
              <li>Open this guide from the header help button or search “guide” in the palette</li>
            </ul>
          </InfoExpandableSection>

          <InfoExpandableSection title="Keyboard shortcuts" icon={Keyboard}>
            <p className="text-xs text-muted-foreground">
              ⌘ = Command on macOS, Ctrl on Windows/Linux. Customize under Settings → Keyboard
              shortcuts.
            </p>
            <div className="space-y-2">
              {HELP_SHORTCUT_GROUPS.map((group) => (
                <details
                  key={group.category}
                  className="group/shortcut rounded-md border border-border/70 bg-muted/20"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/shortcut:rotate-90"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </span>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border/70">
                    {group.shortcuts.map((shortcut) => (
                      <li
                        key={shortcut.chordId}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span>{shortcut.label}</span>
                        <kbd
                          className={cn(
                            "shrink-0 rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px]",
                          )}
                        >
                          {formatDefaultChord(shortcut.chordId)}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </InfoExpandableSection>
        </div>
      </div>
    </div>
  );
}
