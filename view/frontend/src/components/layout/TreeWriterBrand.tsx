import { cn } from "@/lib/utils";

const LOGO_WRITER = "/tree_light.png";
const LOGO_EXPLORER = "/tree_purple.png";

export function TreeWriterBrand({
  className,
  explorerMode = false,
  onHomeClick,
  homeTitle = "Home",
  railAligned = false,
}: {
  className?: string;
  explorerMode?: boolean;
  onHomeClick?: () => void;
  homeTitle?: string;
  /** Center logo in the header rail column (same width as sidebar icons). */
  railAligned?: boolean;
}) {
  const logo = explorerMode ? LOGO_EXPLORER : LOGO_WRITER;
  const modeLabel = explorerMode ? "Explorer" : "Writer";

  const content = (
    <>
      <img
        src={logo}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 object-contain"
        aria-hidden="true"
      />
      {!railAligned ? (
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">TreeWriter</span>
      ) : null}
      <span className="sr-only">{modeLabel} mode</span>
    </>
  );

  if (!onHomeClick) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center",
          railAligned ? "justify-center" : "gap-1.5",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onHomeClick}
      className={cn(
        "flex shrink-0 items-center rounded-md text-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        railAligned
          ? "h-8 w-8 justify-center p-0 hover:bg-accent/60"
          : "gap-1.5 px-1 py-0.5 -ml-1 hover:bg-accent/60",
        className,
      )}
      aria-label={homeTitle}
      title={homeTitle}
    >
      {content}
    </button>
  );
}
