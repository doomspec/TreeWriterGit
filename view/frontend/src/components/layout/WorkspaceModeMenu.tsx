import { Check, ChevronDown, FileCode2, PenLine, TerminalSquare } from "lucide-react";

import { PopoverMenu, PopoverMenuItem, PopoverMenuSection } from "@/components/ui/PopoverMenu";
import { cn } from "@/lib/utils";

/**
 * TreeWriter logo acting as a mode dropdown: switch between the authoring
 * Writer workspace and the IDE-style Explorer.
 */
export function WorkspaceModeMenu({
  explorerMode,
  onChange,
  railAligned = false,
}: {
  explorerMode: boolean;
  onChange: (explorer: boolean) => void;
  /** Icon-only trigger centered in the header rail column. */
  railAligned?: boolean;
}) {
  const logo = explorerMode ? "/tree_purple.png" : "/tree_light.png";

  return (
    <PopoverMenu
      align="start"
      aria-label="Switch workspace mode"
      title="Switch workspace mode"
      triggerClassName={cn(railAligned ? "h-8 w-8 justify-center p-0" : "-ml-1 gap-1.5")}
      trigger={(open) =>
        railAligned ? (
          <>
            <img
              src={logo}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
              aria-hidden="true"
            />
            <span className="sr-only">{explorerMode ? "Explorer" : "Writer"} mode</span>
          </>
        ) : (
          <>
            <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">TreeWriter</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {explorerMode ? "Explorer" : "Writer"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </>
        )
      }
    >
      <PopoverMenuSection label="Mode">
        <PopoverMenuItem onClick={() => onChange(false)}>
          <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Writer</span>
          {!explorerMode ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
        </PopoverMenuItem>
        <PopoverMenuItem onClick={() => onChange(true)}>
          <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Explorer</span>
          {explorerMode ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
        </PopoverMenuItem>
      </PopoverMenuSection>
    </PopoverMenu>
  );
}
