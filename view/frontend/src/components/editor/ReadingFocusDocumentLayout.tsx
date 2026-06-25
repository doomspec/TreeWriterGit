import { useReadingFocus } from "@/lib/readingFocus";
import { cn } from "@/lib/utils";

function FocusProseColumn({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="reading-focus-document__prose-column">
      {title ? <div className="reading-focus-document__title">{title}</div> : null}
      <div className="reading-focus-document__content-row">
        <div className="reading-focus-document__body">{children}</div>
      </div>
    </div>
  );
}

export function ReadingFocusDocumentLayout({
  title,
  children,
  stackClassName,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  stackClassName?: string;
}) {
  const { active } = useReadingFocus();

  if (!active) {
    return (
      <div className={cn(title ? cn("flex flex-col gap-4", stackClassName) : stackClassName)}>
        {title}
        {children}
      </div>
    );
  }

  return (
    <div className="reading-focus-document reading-focus-document--no-graph">
      <FocusProseColumn title={title}>{children}</FocusProseColumn>
    </div>
  );
}
