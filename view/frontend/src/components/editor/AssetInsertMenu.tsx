import { useState } from "react";
import { Layers } from "lucide-react";

import { AssetManagerModal } from "@/components/editor/AssetManagerModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AssetInsertMenuProps = {
  paperPath: string;
  filePath: string;
  refreshVersion: number;
  disabled?: boolean;
  embedded?: boolean;
  inline?: boolean;
  onInsert: (snippet: string) => void;
};

export function AssetInsertMenu({
  paperPath,
  filePath,
  refreshVersion,
  disabled = false,
  embedded = false,
  inline = false,
  onInsert,
}: AssetInsertMenuProps) {
  const [open, setOpen] = useState(false);

  const toggleOpen = () => setOpen((value) => !value);

  return (
    <>
      <Button
        type="button"
        variant={open ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1 text-[10px]",
          inline || embedded ? "w-7 px-0" : "px-2",
        )}
        title="Insert figure, table, equation, or reference"
        aria-label="Insert asset"
        aria-haspopup="dialog"
        disabled={disabled}
        onMouseDown={
          inline
            ? (event) => {
                event.preventDefault();
                if (!disabled) toggleOpen();
              }
            : undefined
        }
        onClick={inline ? undefined : () => !disabled && toggleOpen()}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        <span className={inline || embedded ? "sr-only" : "hidden sm:inline"}>Assets</span>
      </Button>

      <AssetManagerModal
        open={open}
        mode="insert"
        paperPath={paperPath}
        filePath={filePath}
        refreshVersion={refreshVersion}
        onClose={() => setOpen(false)}
        onError={() => setOpen(false)}
        onInsert={onInsert}
      />
    </>
  );
}
