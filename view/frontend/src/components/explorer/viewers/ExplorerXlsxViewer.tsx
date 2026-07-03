import { useEffect, useState } from "react";
import readXlsxFile, { type Sheet } from "read-excel-file/browser";

import { fetchModelAssetBytes } from "@/modelApi";
import { cn } from "@/lib/utils";

/** Read-only xlsx table view — writing xlsx back out is out of scope; view only. */
export function ExplorerXlsxViewer({
  path,
  onError,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setError(null);
    void fetchModelAssetBytes(path)
      .then((bytes) => readXlsxFile(bytes))
      .then((result) => {
        if (cancelled) return;
        setSheets(result);
        setActiveSheet(result[0]?.sheet ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onError?.(message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, onError]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">{error}</div>
    );
  }

  if (!sheets || !activeSheet) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Loading…</div>
    );
  }

  const rows = sheets.find((sheet) => sheet.sheet === activeSheet)?.data ?? [];
  const columnCount = Math.max(1, ...rows.map((row) => row.length));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1">
          {sheets.map(({ sheet: name }) => (
            <button
              key={name}
              type="button"
              className={cn(
                "shrink-0 rounded px-2 py-1 text-[11px]",
                name === activeSheet
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <table className="border-collapse text-xs">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnCount }, (_, colIndex) => (
                  <td key={colIndex} className="border border-border px-1.5 py-1 text-foreground">
                    {String(row[colIndex] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
