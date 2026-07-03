import { Columns2, Eye, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EditorLayout } from "@/lib/editor/layout";
import { cn } from "@/lib/utils";

const DEFAULT_LAYOUT_BUTTONS: { id: EditorLayout; icon: typeof FileCode2; label: string }[] = [
  { id: "source", icon: FileCode2, label: "Source" },
  { id: "split", icon: Columns2, label: "Split" },
  { id: "preview", icon: Eye, label: "Preview" },
];

/** Source/split/preview 3-way toggle, extracted from EditorWorkspace.tsx for reuse outside Writer mode. */
export function EditorLayoutToggle({
  layout,
  onLayoutChange,
  className,
}: {
  layout: EditorLayout;
  onLayoutChange: (layout: EditorLayout) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-border p-0.5", className)}>
      {DEFAULT_LAYOUT_BUTTONS.map(({ id, icon: Icon, label }) => (
        <Button
          key={id}
          type="button"
          variant={layout === id ? "default" : "ghost"}
          size="icon"
          className="h-6 w-6"
          aria-label={label}
          title={label}
          onClick={() => onLayoutChange(id)}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
