import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ThemePreference } from "@/lib/themePreferences";
import { cn } from "@/lib/utils";

const MODE_META: Record<
  ThemePreference,
  { label: string; title: string; icon: typeof Sun }
> = {
  light: { label: "Light", title: "Light mode", icon: Sun },
  dark: { label: "Dark", title: "Dark mode", icon: Moon },
  system: { label: "System", title: "System theme", icon: Monitor },
};

export function ThemeToggle({
  preference,
  onCycle,
  className,
}: {
  preference: ThemePreference;
  onCycle: () => void;
  className?: string;
}) {
  const meta = MODE_META[preference];
  const Icon = meta.icon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-9 w-9", className)}
      title={`${meta.title} — click to change`}
      aria-label={`Theme: ${meta.label}. Click to cycle light, dark, and system.`}
      onClick={onCycle}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

export function ThemePreferenceSelect({
  preference,
  onChange,
  className,
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  className?: string;
}) {
  const options: ThemePreference[] = ["light", "dark", "system"];

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map((option) => {
        const meta = MODE_META[option];
        const Icon = meta.icon;
        const selected = preference === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
              selected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => onChange(option)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
