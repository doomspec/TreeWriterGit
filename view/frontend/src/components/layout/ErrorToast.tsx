import { cn } from "@/lib/utils";

export function ErrorToast({
  message,
  onDismiss,
  children,
  className,
}: {
  message: string;
  onDismiss: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "fixed bottom-3 right-3 z-[80] flex max-w-lg items-start gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-2 text-xs text-destructive shadow-lg",
        className,
      )}
    >
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{message}</span>
      <div className="flex shrink-0 flex-col gap-1">
        {children}
        <button type="button" className="underline" onClick={onDismiss}>
          dismiss
        </button>
      </div>
    </div>
  );
}
