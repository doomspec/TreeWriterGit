import type { NavigateTarget } from "@/lib/modelTree";
import { parentPath } from "@/lib/modelTree";
import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

export function ReadingFocusTitleLink({
  title,
  contextPath,
  onNavigate,
  className,
}: {
  title: string;
  contextPath: string;
  onNavigate?: (target: NavigateTarget) => void;
  className?: string;
}) {
  const { active } = useReadingFocus();
  const upPath = contextPath ? parentPath(contextPath) : "";
  const upLabel = upPath.split("/").pop() ?? "section";

  if (!active || !upPath || !onNavigate) {
    return (
      <h1
        className={cn(
          "font-serif text-2xl font-semibold tracking-tight text-foreground",
          className,
        )}
      >
        {title}
      </h1>
    );
  }

  return (
    <h1
      className={cn(
        "font-serif text-2xl font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <button
        type="button"
        className="reading-focus-title-link"
        title={`Go to ${upLabel}`}
        aria-label={`Go to ${upLabel}: ${title}`}
        onClick={() => onNavigate({ type: "folder", path: upPath })}
      >
        {title}
      </button>
    </h1>
  );
}
