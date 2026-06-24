import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

export function ReadingFocusToggleButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { active, toggle } = useReadingFocus();

  return (
    <Button
      type="button"
      variant={active ? "default" : variant}
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      title={active ? "Exit reading focus (Esc)" : "Reading focus — hide interface (⌘⇧F)"}
      aria-label={active ? "Exit reading focus" : "Enter reading focus"}
      aria-pressed={active}
      onClick={toggle}
    >
      {active ? (
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
