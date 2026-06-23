import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { PopoverMenu, PopoverMenuSection } from "@/components/ui/PopoverMenu";

/** Secondary pane controls (zoom, status, AI) behind an overflow menu. */
export function EditorPaneOverflowMenu({
  statusText,
  children,
  className,
}: {
  statusText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PopoverMenu
      className={className}
      aria-label="Pane options"
      trigger={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
    >
      {statusText ? (
        <PopoverMenuSection label="Status">
          <div className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{statusText}</div>
        </PopoverMenuSection>
      ) : null}
      <PopoverMenuSection>{children}</PopoverMenuSection>
    </PopoverMenu>
  );
}
