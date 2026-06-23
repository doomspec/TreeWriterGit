import { useLayoutEffect } from "react";
import { ArrowLeft, Minimize2 } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

export function ReadingFocusNavBar({
  path,
  onNavigate,
  breadcrumbVariant = "default",
  canBack = false,
  onBack,
  backTitle = "Back",
}: {
  path: string;
  onNavigate: (path: string) => void;
  breadcrumbVariant?: "default" | "papers";
  canBack?: boolean;
  onBack?: () => void;
  backTitle?: string;
}) {
  const { active, exit, extraChrome } = useReadingFocus();

  if (!active) return null;

  return (
    <div className="reading-focus-nav-bar" role="navigation" aria-label="Reading focus">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {canBack && onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title={backTitle}
            aria-label={backTitle}
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
        {extraChrome ? <div className="flex shrink-0 items-center gap-1">{extraChrome}</div> : null}
        <Breadcrumbs path={path} onNavigate={onNavigate} compact variant={breadcrumbVariant} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-[10px]"
        title="Exit reading focus (Esc)"
        aria-label="Exit reading focus"
        onClick={exit}
      >
        <Minimize2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Exit focus
      </Button>
    </div>
  );
}

export function ReadingFocusExtra({
  focusedPane,
  onPaneChange,
  labels,
}: {
  focusedPane: "outline" | "draft" | "split";
  onPaneChange: (pane: "outline" | "draft" | "split") => void;
  labels?: { left: string; right: string; split: string };
}) {
  const { active, setExtraChrome } = useReadingFocus();

  useLayoutEffect(() => {
    if (!active) {
      setExtraChrome(null);
      return;
    }
    setExtraChrome(
      <ReadingFocusPaneToggle focusedPane={focusedPane} onPaneChange={onPaneChange} labels={labels} />,
    );
    return () => setExtraChrome(null);
  }, [active, focusedPane, labels, onPaneChange, setExtraChrome]);

  return null;
}

export function ReadingFocusPaneToggle({
  focusedPane,
  onPaneChange,
  labels = { left: "Outline", right: "Draft", split: "Both" },
}: {
  focusedPane: "outline" | "draft" | "split";
  onPaneChange: (pane: "outline" | "draft" | "split") => void;
  labels?: { left: string; right: string; split: string };
}) {
  const options = [
    { id: "outline" as const, label: labels.left },
    { id: "draft" as const, label: labels.right },
    { id: "split" as const, label: labels.split },
  ];

  return (
    <div
      className="inline-flex rounded-md border border-border/80 bg-background/80 p-0.5"
      role="group"
      aria-label="Switch pane"
    >
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
            focusedPane === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={focusedPane === id}
          onClick={() => onPaneChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
