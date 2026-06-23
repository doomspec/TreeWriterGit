import { cn } from "@/lib/utils";

export function ReadingFocusEditBar({
  toolbar,
  trailing,
  className,
}: {
  toolbar: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("reading-focus-edit-bar shrink-0", className)}
      role="toolbar"
      aria-label="Focus mode editing"
    >
      <div className="reading-focus-edit-bar__inner">
        <div className="reading-focus-edit-bar__toolbar">{toolbar}</div>
        {trailing ? <div className="reading-focus-edit-bar__actions">{trailing}</div> : null}
      </div>
    </div>
  );
}
