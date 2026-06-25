import { BookOpen, ChevronRight, Command, Download, Keyboard, Sparkles, type LucideIcon } from "lucide-react";

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

function GuideSectionSummary({
  title,
  icon: Icon,
}: {
  title: string;
  icon: LucideIcon;
}) {
  return (
    <summary className="info-guide__summary">
      <span className="info-guide__chevron" aria-hidden="true">
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <span className="info-guide__icon" aria-hidden="true">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="info-guide__title">{title}</span>
    </summary>
  );
}

function InfoExpandableSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="info-guide__section group/info-section"
      open={defaultOpen}
    >
      <GuideSectionSummary title={title} icon={icon} />
      <div className="info-guide__body">{children}</div>
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
    <details className="info-guide__nested group/feature">
      <summary className="info-guide__nested-summary">
        <span className="info-guide__chevron" aria-hidden="true">
          <ChevronRight className="h-3 w-3" />
        </span>
        <span className="info-guide__nested-title">{title}</span>
      </summary>
      <div className="info-guide__nested-body">
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
        {hints?.length ? (
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
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
    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}

export function InfoGuideContent({ className }: { className?: string }) {
  return (
    <div className={cn("info-guide", className)}>
      <InfoExpandableSection title="Quick start" icon={BookOpen} defaultOpen>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
          {HELP_QUICK_START.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </InfoExpandableSection>

      <InfoExpandableSection title="Features" icon={Sparkles}>
        <p className="text-xs text-muted-foreground">
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

      <InfoExpandableSection title="Overleaf integration" icon={Download}>
        <p className="text-xs leading-relaxed text-muted-foreground">{HELP_OVERLEAF.intro}</p>
        <div className="space-y-2">
          {HELP_OVERLEAF.steps.map((step) => (
            <div
              key={step.title}
              className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2"
            >
              <h3 className="text-xs font-medium">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Hints
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {HELP_OVERLEAF.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      </InfoExpandableSection>

      <InfoExpandableSection title="Command palette" icon={Command}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Press <Kbd>{paletteChordLabel()}</Kbd> or <Kbd>{paletteAltChordLabel()}</Kbd> anywhere to
          open the palette.
        </p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>↑↓ to navigate results, Enter to run, Esc to close</li>
          <li>Commands respect context — create actions only appear where they apply</li>
          <li>Open this guide from the sidebar help button or search “guide” in the palette</li>
        </ul>
      </InfoExpandableSection>

      <InfoExpandableSection title="Keyboard shortcuts" icon={Keyboard}>
        <p className="text-[11px] text-muted-foreground">
          ⌘ = Command on macOS, Ctrl on Windows/Linux. Customize under Settings → Keyboard shortcuts.
        </p>
        <div className="space-y-2">
          {HELP_SHORTCUT_GROUPS.map((group) => (
            <details key={group.category} className="info-guide__nested group/shortcut">
              <summary className="info-guide__nested-summary">
                <span className="info-guide__chevron" aria-hidden="true">
                  <ChevronRight className="h-3 w-3" />
                </span>
                <span className="info-guide__nested-title info-guide__nested-title--category">
                  {group.category}
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border/70">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.chordId}
                    className="flex flex-col gap-0.5 px-2.5 py-1.5 text-xs"
                  >
                    <span>{shortcut.label}</span>
                    <kbd className="w-fit rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
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
  );
}
