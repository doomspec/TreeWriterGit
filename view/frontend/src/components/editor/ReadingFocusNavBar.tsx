import { useLayoutEffect } from "react";

import { useReadingFocus } from "@/lib/readingFocus";
import type { DualPaneView } from "@/lib/workspacePreferences";
import { cn } from "@/lib/utils";

export function useReadingFocusSplitPaneTitles(paneView: DualPaneView): boolean {
  const { active } = useReadingFocus();
  return active && paneView === "split";
}

export function ReadingFocusSplitPaneTitle({ label }: { label: string }) {
  return (
    <div className="reading-focus-split-pane-title ui-pane-header shrink-0 min-h-8 py-1">
      <span className="ui-label truncate">{label}</span>
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
