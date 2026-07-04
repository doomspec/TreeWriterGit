import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NamePromptDialog({
  open,
  title,
  label,
  defaultValue = "",
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [defaultValue, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, open]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-_]*$/.test(trimmed)) {
      setError("Use lowercase letters, numbers, hyphens, underscores");
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
      >
        <h2 id="name-prompt-title" className="text-sm font-semibold">
          {title}
        </h2>
        <label className="mt-3 block text-xs text-muted-foreground" htmlFor="name-prompt-input">
          {label}
        </label>
        <input
          ref={inputRef}
          id="name-prompt-input"
          className={cn(
            "mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none ring-primary focus:ring-1",
            error ? "border-destructive" : "border-border",
          )}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="h-8 px-3 text-xs" onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Keeps the dialog open with actions disabled and a spinner while an async confirm runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open || loading) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (loading) return;
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "outline" : "default"}
            className={cn("h-8 gap-1.5 px-3 text-xs", destructive && "border-destructive text-destructive")}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
