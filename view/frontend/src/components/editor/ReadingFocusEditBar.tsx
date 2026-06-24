import { cn } from "@/lib/utils";

export function ReadingFocusEditBar({
  title,
  toolbar,
  trailing,
  className,
}: {
  title?: string;
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
        <div className="reading-focus-edit-bar__toolbar">
          {title ? (
            <span className="reading-focus-edit-bar__title ui-label shrink-0 truncate">{title}</span>
          ) : null}
          {toolbar}
        </div>
        {trailing ? <div className="reading-focus-edit-bar__actions">{trailing}</div> : null}
      </div>
    </div>
  );
}
