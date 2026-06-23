import { BookOpen, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReadingFocus } from "@/lib/readingFocus";

export function EditorFocusToggle({ className }: { className?: string }) {
  const { active, toggle } = useReadingFocus();

  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      className={className}
      title={active ? "Exit reading focus (Esc)" : "Reading focus — hide interface"}
      aria-label={active ? "Exit reading focus" : "Enter reading focus"}
      aria-pressed={active}
      onClick={toggle}
    >
      {active ? (
        <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">Reading focus</span>
      <BookOpen className="ml-1 hidden h-3 w-3 opacity-60 sm:inline" aria-hidden="true" />
    </Button>
  );
}
