import { useEffect, useState } from "react";
import { Download, Inbox, Link2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  connectOverleaf,
  exportPaper,
  exportPaperBatch,
  fetchOverleafStatus,
  importOverleafFeedback,
  pushToOverleaf,
  type OverleafStatus,
} from "@/modelApi";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export function PaperExportPanel({
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
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pushingOverleaf, setPushingOverleaf] = useState(false);
  const [importingOverleaf, setImportingOverleaf] = useState(false);
  const [connectingOverleaf, setConnectingOverleaf] = useState(false);
  const [overleafStatus, setOverleafStatus] = useState<OverleafStatus | null>(null);
  const [overleafGitUrl, setOverleafGitUrl] = useState("");
  const [overleafToken, setOverleafToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const overleafConnected = overleafStatus?.connected ?? false;
  const busy = exporting || pushingOverleaf || importingOverleaf || connectingOverleaf;
  const disabled = !paperSlug || busy;

  const loadOverleafStatus = async (slug: string) => {
    try {
      const status = await fetchOverleafStatus(slug);
      setOverleafStatus(status);
      if (status.gitUrl && !overleafGitUrl) {
        setOverleafGitUrl(status.gitUrl);
      }
    } catch (err) {
      setOverleafStatus(null);
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!paperSlug) {
      setOverleafStatus(null);
      setOverleafGitUrl("");
      return;
    }
    void loadOverleafStatus(paperSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperSlug]);

  const handleExport = async (format: "latex" | "pdf" | "docx") => {
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
      if (result.orphanCrossRefs?.length) {
        notices.push(`Orphan cross-refs: ${result.orphanCrossRefs.join(", ")}`);
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
        formats: ["latex", "pdf", "docx"],
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
      const orphans = [...new Set(results.flatMap((r) => r.orphanCrossRefs ?? []))];
      if (orphans.length) notices.push(`Orphan cross-refs: ${orphans.join(", ")}`);
      setNotice(notices.length ? notices.join(" · ") : "Exported LaTeX, PDF, and Word");
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleOverleafConnect = async () => {
    if (!paperSlug || !overleafGitUrl.trim()) return;
    setConnectingOverleaf(true);
    setNotice(null);
    try {
      const result = await connectOverleaf({
        paperSlug,
        gitUrl: overleafGitUrl.trim(),
        token: overleafToken.trim() || undefined,
      });
      setNotice(result.message);
      await loadOverleafStatus(paperSlug);
      onComplete?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingOverleaf(false);
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
      if (result.orphanCrossRefs?.length) {
        notices.push(`Orphan cross-refs: ${result.orphanCrossRefs.join(", ")}`);
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

  if (!paperSlug) {
    return (
      <div className={cn("p-3 text-xs leading-normal text-muted-foreground", className)}>
        Open a paper to export LaTeX/PDF or sync with Overleaf.
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="shrink-0 border-b border-border px-3 py-2">
        <p className="ui-label">Export &amp; Overleaf</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
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

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Download
            </p>
            <div className="grid grid-cols-3 gap-1.5">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-center bg-card px-2"
                disabled={disabled}
                title="Word document via markdown-docx"
                onClick={() => void handleExport("docx")}
              >
                Word
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
              LaTeX + PDF + Word
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Overleaf
              </p>
              {overleafConnected ? (
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Connected
                </span>
              ) : null}
            </div>

            {overleafConnected ? (
              <p className="text-[11px] leading-normal text-muted-foreground">
                {overleafStatus?.projectId
                  ? `Project ${overleafStatus.projectId.slice(0, 8)}…`
                  : "Local clone linked"}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-normal text-muted-foreground">
                  Paste the Git URL from Overleaf → Menu → Git to link this paper.
                </p>
                <input
                  type="url"
                  className="h-8 w-full rounded-sm border border-border bg-background px-2 font-mono text-[11px]"
                  value={overleafGitUrl}
                  disabled={disabled}
                  placeholder="https://git.overleaf.com/…"
                  onChange={(e) => setOverleafGitUrl(e.target.value)}
                />
                <input
                  type="password"
                  className="h-8 w-full rounded-sm border border-border bg-background px-2 text-[11px]"
                  value={overleafToken}
                  disabled={disabled}
                  placeholder="Git token (optional if cached)"
                  autoComplete="off"
                  onChange={(e) => setOverleafToken(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-center gap-1.5 bg-card"
                  disabled={disabled || !overleafGitUrl.trim()}
                  onClick={() => void handleOverleafConnect()}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {connectingOverleaf ? "Connecting…" : "Connect Overleaf"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-center gap-1 bg-card px-2"
                disabled={disabled || !overleafConnected}
                title={
                  overleafConnected ? "Export LaTeX and push to Overleaf" : "Connect Overleaf first"
                }
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
                disabled={disabled || !overleafConnected}
                title={
                  overleafConnected
                    ? "Import \\todo comments from Overleaf main.tex"
                    : "Connect Overleaf first"
                }
                onClick={() => void handleOverleafImport()}
              >
                <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Import
              </Button>
            </div>

            {overleafConnected ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-center px-2 text-[11px] text-muted-foreground"
                disabled={disabled}
                onClick={() => void handleOverleafConnect()}
              >
                {connectingOverleaf ? "Refreshing…" : "Refresh clone from Overleaf"}
              </Button>
            ) : null}
          </div>
        </div>

        {notice ? (
          <p className="mt-4 border-t border-border pt-3 text-[11px] leading-normal text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
