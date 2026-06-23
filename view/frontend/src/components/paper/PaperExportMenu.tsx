import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, Inbox, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  exportPaper,
  exportPaperBatch,
  importOverleafFeedback,
  pushToOverleaf,
} from "@/modelApi";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export function PaperExportMenu({
  paperSlug,
  onError,
  onComplete,
  className,
}: {
  paperSlug: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pushingOverleaf, setPushingOverleaf] = useState(false);
  const [importingOverleaf, setImportingOverleaf] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = exporting || pushingOverleaf || importingOverleaf;
  const disabled = !paperSlug || busy;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handleExport = async (format: "latex" | "pdf") => {
    if (!paperSlug) return;
    setExporting(true);
    setNotice(null);
    try {
      const result = await exportPaper({ paperSlug, format, includeDrafts });
      window.open(`${apiBaseUrl}${result.downloadUrl}`, "_blank");
      const notices: string[] = [];
      if (result.notice) notices.push(result.notice);
      if (result.missingCitations?.length) {
        notices.push(`Missing citations: ${result.missingCitations.join(", ")}`);
      }
      setNotice(notices.length ? notices.join(" · ") : null);
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleExportBatch = async () => {
    if (!paperSlug) return;
    setExporting(true);
    setNotice(null);
    try {
      const { results } = await exportPaperBatch({
        paperSlug,
        formats: ["latex", "pdf"],
        includeDrafts,
      });
      for (const result of results) {
        window.open(`${apiBaseUrl}${result.downloadUrl}`, "_blank");
      }
      const notices: string[] = [];
      for (const result of results) {
        if (result.notice) notices.push(result.notice);
      }
      const missing = [...new Set(results.flatMap((r) => r.missingCitations ?? []))];
      if (missing.length) notices.push(`Missing citations: ${missing.join(", ")}`);
      setNotice(notices.length ? notices.join(" · ") : "Exported LaTeX and PDF");
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleOverleafPush = async () => {
    if (!paperSlug) return;
    setPushingOverleaf(true);
    setNotice(null);
    try {
      const result = await pushToOverleaf({ paperSlug, includeDrafts });
      const notices = [result.message];
      if (result.missingCitations?.length) {
        notices.push(`Missing citations: ${result.missingCitations.join(", ")}`);
      }
      setNotice(notices.join(" · "));
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushingOverleaf(false);
    }
  };

  const handleOverleafImport = async () => {
    if (!paperSlug) return;
    setImportingOverleaf(true);
    setNotice(null);
    try {
      const result = await importOverleafFeedback(paperSlug);
      setNotice(
        result.imported > 0
          ? `Imported ${result.imported} Overleaf feedback note${result.imported === 1 ? "" : "s"}`
          : "No \\todo comments found in main.tex",
      );
      if (result.imported > 0) onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingOverleaf(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 px-2.5"
        disabled={!paperSlug}
        aria-expanded={open}
        aria-haspopup="menu"
        title={paperSlug ? "Export & Overleaf" : "Open a paper to export"}
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </Button>

      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              className="fixed z-overlay w-[15.5rem] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Export &amp; Overleaf
              </p>

              <label className="mb-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={includeDrafts}
                  disabled={disabled}
                  onChange={(e) => setIncludeDrafts(e.target.checked)}
                />
                <span className="text-xs leading-normal text-muted-foreground">
                  Include outlines and non-approved drafts
                </span>
              </label>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Download
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-center bg-card px-2"
                      disabled={disabled}
                      onClick={() => void handleExport("latex")}
                    >
                      LaTeX
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-center bg-card px-2"
                      disabled={disabled}
                      title="Requires tectonic or MacTeX; falls back to .tex"
                      onClick={() => void handleExport("pdf")}
                    >
                      PDF
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 w-full justify-center gap-1.5"
                    disabled={disabled}
                    onClick={() => void handleExportBatch()}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    LaTeX + PDF
                  </Button>
                </div>

                <div className="space-y-1.5 border-t border-border pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Overleaf
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-center gap-1 bg-card px-2"
                      disabled={disabled}
                      title="Requires overleaf_repo_path in paper INDEX.md"
                      onClick={() => void handleOverleafPush()}
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Push
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-center gap-1 bg-card px-2"
                      disabled={disabled}
                      title="Import \\todo comments from Overleaf main.tex"
                      onClick={() => void handleOverleafImport()}
                    >
                      <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>

              {notice ? (
                <p className="mt-3 border-t border-border pt-2 text-[11px] leading-normal text-muted-foreground">
                  {notice}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
