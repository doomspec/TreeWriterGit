import { useCallback, useEffect, useMemo } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseCsv, serializeCsv } from "@/lib/csv";
import { useFileDocumentEditor } from "@/lib/hooks/useFileDocumentEditor";
import { cn } from "@/lib/utils";

const SAVE_LABEL: Record<string, string> = {
  idle: "Saved",
  dirty: "Unsaved…",
  saving: "Saving…",
  saved: "Saved",
  error: "Error",
};

/** Editable CSV grid for Explorer — plain text under the hood, no new backend endpoint needed. */
export function ExplorerCsvGrid({
  path,
  onError,
  onSavingChange,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const editor = useFileDocumentEditor({
    filePath: path,
    refreshVersion: 0,
    requiresApproval: false,
    onError,
  });

  useEffect(() => {
    onSavingChange?.(editor.saveState === "saving");
  }, [editor.saveState, onSavingChange]);

  const rows = useMemo(() => parseCsv(editor.content), [editor.content]);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const displayRows = rows.length > 0 ? rows : [[""]];

  const commit = useCallback((nextRows: string[][]) => editor.setContent(serializeCsv(nextRows)), [editor]);

  const setCell = (rowIndex: number, colIndex: number, value: string) => {
    const next = displayRows.map((row) => {
      const padded = [...row];
      while (padded.length < columnCount) padded.push("");
      return padded;
    });
    next[rowIndex][colIndex] = value;
    commit(next);
  };

  const addRow = () => commit([...displayRows, Array.from({ length: columnCount }, () => "")]);
  const addColumn = () => commit(displayRows.map((row) => [...row, ""]));
  const deleteRow = (rowIndex: number) => {
    if (displayRows.length <= 1) return;
    commit(displayRows.filter((_, index) => index !== rowIndex));
  };
  const deleteColumn = (colIndex: number) => {
    if (columnCount <= 1) return;
    commit(displayRows.map((row) => row.filter((_, index) => index !== colIndex)));
  };

  if (editor.loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {editor.loadError}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
        <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={addRow}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          Row
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={addColumn}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          Column
        </Button>
        <span className="ml-2 min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {SAVE_LABEL[editor.saveState] ?? "Saved"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <table className="border-collapse text-xs">
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnCount }, (_, colIndex) => (
                  <td key={colIndex} className="border border-border p-0">
                    <input
                      type="text"
                      value={row[colIndex] ?? ""}
                      aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`}
                      className="h-7 w-32 bg-background px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
                    />
                  </td>
                ))}
                <td className="p-0 pl-1">
                  <button
                    type="button"
                    aria-label={`Delete row ${rowIndex + 1}`}
                    disabled={displayRows.length <= 1}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive",
                      displayRows.length <= 1 && "opacity-30",
                    )}
                    onClick={() => deleteRow(rowIndex)}
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {Array.from({ length: columnCount }, (_, colIndex) => (
                <td key={colIndex} className="p-0 pt-1 text-center">
                  <button
                    type="button"
                    aria-label={`Delete column ${colIndex + 1}`}
                    disabled={columnCount <= 1}
                    className={cn(
                      "flex h-6 w-full items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive",
                      columnCount <= 1 && "opacity-30",
                    )}
                    onClick={() => deleteColumn(colIndex)}
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
