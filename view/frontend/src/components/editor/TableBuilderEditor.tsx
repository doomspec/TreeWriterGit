import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  FileCode2,
  Rows3,
  Table2,
  Trash2,
} from "lucide-react";

import { PendingApprovalChip } from "@/components/editor/PendingApprovalChip";
import { HighlightingTextarea } from "@/components/editor/HighlightingTextarea";
import { MarkdownViewer } from "@/components/editor/MarkdownViewer";
import { Button } from "@/components/ui/button";
import {
  draftSaveMeta,
  draftStatusLabel,
  loadDraftApprovalState,
  loadModelFileContent,
  resolvePendingApprovalDisplay,
} from "@/lib/draftApproval";
import { effectiveDiffBaseline } from "@/lib/draftDiff";
import { cn } from "@/lib/utils";
import {
  initTableDraft,
  parseTableDraft,
  serializeTableDraft,
  type ParsedTableDraft,
  type TableAlign,
} from "@/lib/tableMarkdown";
import { useDraftAutosave } from "@/lib/useDraftAutosave";

import { saveModelFile } from "@/modelApi";

function TableGridPicker({
  maxRows = 8,
  maxCols = 8,
  onSelect,
}: {
  maxRows?: number;
  maxCols?: number;
  onSelect: (rows: number, cols: number) => void;
}) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  return (
    <div className="table-grid-picker">
      <p className="mb-2 text-xs text-muted-foreground">
        Insert table — hover to choose size, click to confirm
        {hover.rows > 0 ? ` (${hover.rows} × ${hover.cols})` : ""}
      </p>
      <div
        className="inline-grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${maxCols}, 1.25rem)` }}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: maxRows * maxCols }, (_, i) => {
          const row = Math.floor(i / maxCols) + 1;
          const col = (i % maxCols) + 1;
          const active = row <= hover.rows && col <= hover.cols;
          return (
            <button
              key={i}
              type="button"
              className={cn(
                "h-5 w-5 rounded-sm border border-border/80 transition-colors",
                active ? "bg-primary/70 border-primary" : "bg-muted/40 hover:bg-muted",
              )}
              aria-label={`${row} by ${col} table`}
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onClick={() => onSelect(row, col)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TableBuilderEditor({
  filePath,
  tableTitle,
  refreshVersion,
  onError,
  onModelChanged,
  className,
}: {
  filePath: string;
  tableTitle: string;
  refreshVersion: number;
  onError: (message: string) => void;
  onModelChanged?: () => void;
  className?: string;
}) {
  const [data, setData] = useState<ParsedTableDraft>(() => initTableDraft(2, 2, tableTitle));
  const [loaded, setLoaded] = useState("");
  const [approvedBaseline, setApprovedBaseline] = useState("");
  const [editMeta, setEditMeta] = useState({
    editedBy: null as string | null,
    aiAssisted: false,
    aiProvider: null as string | null,
  });
  const [mode, setMode] = useState<"visual" | "raw">("visual");
  const [rawText, setRawText] = useState("");
  const currentContent = mode === "raw" ? rawText : serializeTableDraft(data);

  const applyContent = useCallback(
    (content: string) => {
      const parsed = parseTableDraft(content, tableTitle);
      setData(parsed);
      const serialized = serializeTableDraft(parsed);
      setLoaded(serialized);
      setRawText(content);
    },
    [tableTitle],
  );

  const syncAfterSave = useCallback(
    (content: string) => {
      if (mode === "raw") {
        setData(parseTableDraft(content, tableTitle));
      } else {
        setRawText(content);
      }
    },
    [mode, tableTitle],
  );

  const saveContent = useCallback(
    async (content: string, pendingSource: "human" | "ai" | null) => {
      await saveModelFile(filePath, content, draftSaveMeta(pendingSource));
      syncAfterSave(content);
    },
    [filePath, syncAfterSave],
  );

  const {
    saveState,
    isDirty,
    isPendingApproval,
    pendingSource,
    githubHandle,
    handleApprove,
    handleDiscard,
    setSaveState,
  } = useDraftAutosave({
    targetPath: filePath,
    content: currentContent,
    loadedContent: loaded,
    setLoadedContent: setLoaded,
    approvedBaseline,
    setApprovedBaseline,
    saveContent,
    reloadAfterDiscard: () => loadModelFileContent(filePath),
    onError,
    onSaved: onModelChanged,
    onDiscarded: applyContent,
    onApproved: () => applyContent(currentContent),
    editMeta,
  });

  const approvalDisplay = resolvePendingApprovalDisplay({
    editMeta,
    pendingSource,
    githubHandle,
    isDirty,
  });

  useEffect(() => {
    let cancelled = false;
    void loadDraftApprovalState(filePath).then(({ content: baseline, meta }) => {
      if (!cancelled) {
        setApprovedBaseline(baseline);
        setEditMeta({ editedBy: meta.editedBy, aiAssisted: meta.aiAssisted, aiProvider: meta.aiProvider });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filePath, refreshVersion]);

  useEffect(() => {
    let cancelled = false;
    void loadModelFileContent(filePath)
      .then((content) => {
        if (cancelled) return;
        applyContent(content);
        setSaveState("idle");
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [applyContent, filePath, onError, refreshVersion, setSaveState, tableTitle]);

  const colCount = useMemo(
    () => Math.max(data.headers.length, data.aligns.length, ...data.rows.map((r) => r.length), 1),
    [data],
  );

  const updateCell = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setData((prev) => {
      if (rowIndex === -1) {
        const headers = [...prev.headers];
        headers[colIndex] = value;
        return { ...prev, headers };
      }
      const rows = prev.rows.map((row) => [...row]);
      rows[rowIndex][colIndex] = value;
      return { ...prev, rows };
    });
  }, []);

  const setColumnAlign = useCallback((colIndex: number, align: TableAlign) => {
    setData((prev) => {
      const aligns = [...prev.aligns];
      aligns[colIndex] = align;
      return { ...prev, aligns };
    });
  }, []);

  const insertRow = useCallback((afterIndex: number) => {
    setData((prev) => {
      const cols = Math.max(prev.headers.length, prev.aligns.length, 1);
      const row = Array.from({ length: cols }, () => "");
      const rows = [...prev.rows];
      rows.splice(afterIndex + 1, 0, row);
      return { ...prev, rows };
    });
  }, []);

  const deleteRow = useCallback((index: number) => {
    setData((prev) => {
      if (prev.rows.length <= 1) return prev;
      const rows = prev.rows.filter((_, i) => i !== index);
      return { ...prev, rows };
    });
  }, []);

  const insertColumn = useCallback((afterIndex: number) => {
    setData((prev) => {
      const headers = [...prev.headers];
      headers.splice(afterIndex + 1, 0, `Column ${headers.length + 1}`);
      const aligns = [...prev.aligns];
      aligns.splice(afterIndex + 1, 0, "left");
      const rows = prev.rows.map((row) => {
        const next = [...row];
        next.splice(afterIndex + 1, 0, "");
        return next;
      });
      return { ...prev, headers, aligns, rows };
    });
  }, []);

  const deleteColumn = useCallback((index: number) => {
    setData((prev) => {
      if (prev.headers.length <= 1) return prev;
      return {
        ...prev,
        headers: prev.headers.filter((_, i) => i !== index),
        aligns: prev.aligns.filter((_, i) => i !== index),
        rows: prev.rows.map((row) => row.filter((_, i) => i !== index)),
      };
    });
  }, []);

  const previewMarkdown = currentContent;
  const diffBaseline = useMemo(
    () => effectiveDiffBaseline(approvedBaseline, loaded),
    [approvedBaseline, loaded],
  );
  const saveLabel = draftStatusLabel({
    requiresApproval: true,
    isPendingApproval,
    isDirty,
    saveState,
    defaultLabel: "approved",
  });

  const alignButton = (colIndex: number, align: TableAlign, icon: typeof AlignLeft) => {
    const Icon = icon;
    const active = (data.aligns[colIndex] ?? "left") === align;
    return (
      <Button
        key={align}
        type="button"
        variant={active ? "default" : "ghost"}
        size="icon"
        className="h-6 w-6"
        title={`Align ${align}`}
        onClick={() => setColumnAlign(colIndex, align)}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
      </Button>
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="ui-pane-header shrink-0">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="ui-label">Table</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-ui-2xs text-muted-foreground">{saveLabel}</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={mode === "visual" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => {
                setData(parseTableDraft(rawText, tableTitle));
                setMode("visual");
              }}
            >
              <Table2 className="h-3 w-3" aria-hidden="true" />
              Visual
            </Button>
            <Button
              type="button"
              variant={mode === "raw" ? "default" : "ghost"}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => {
                setRawText(serializeTableDraft(data));
                setMode("raw");
              }}
            >
              <FileCode2 className="h-3 w-3" aria-hidden="true" />
              Markdown
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {mode === "raw" ? (
          <HighlightingTextarea
            className="min-h-[12rem] w-full rounded-md border border-border bg-background p-3 font-mono text-xs leading-5"
            mirrorClassName="p-3 font-mono text-xs leading-5"
            value={rawText}
            baseline={diffBaseline}
            highlight={isPendingApproval}
            spellCheck={false}
            onChange={(event) => setRawText(event.target.value)}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-muted-foreground">Table label</span>
                <input
                  type="text"
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={data.label}
                  onChange={(event) => setData((prev) => ({ ...prev, label: event.target.value }))}
                />
              </label>
              <label className="block text-xs sm:col-span-1">
                <span className="mb-1 block font-medium text-muted-foreground">Caption</span>
                <input
                  type="text"
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={data.caption}
                  placeholder="Caption text shown in the manuscript"
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, caption: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border pb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => insertRow(data.rows.length - 1)}
              >
                <Rows3 className="h-3 w-3" aria-hidden="true" />
                Add row
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => insertColumn(colCount - 1)}
              >
                <Columns3 className="h-3 w-3" aria-hidden="true" />
                Add column
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="table-builder w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr>
                    {Array.from({ length: colCount }, (_, colIndex) => (
                      <th key={colIndex} className="table-builder__head-cell border border-border p-0">
                        <input
                          type="text"
                          className="w-full border-0 bg-muted/30 px-2 py-1.5 text-xs font-semibold outline-none focus:bg-accent/30"
                          value={data.headers[colIndex] ?? ""}
                          placeholder={`Column ${colIndex + 1}`}
                          onChange={(event) => updateCell(-1, colIndex, event.target.value)}
                        />
                        <div className="flex items-center justify-center gap-0.5 border-t border-border/60 py-0.5">
                          {alignButton(colIndex, "left", AlignLeft)}
                          {alignButton(colIndex, "center", AlignCenter)}
                          {alignButton(colIndex, "right", AlignRight)}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            title="Delete column"
                            disabled={colCount <= 1}
                            onClick={() => deleteColumn(colIndex)}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      </th>
                    ))}
                    <th className="w-8 border-0 bg-transparent p-0" aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: colCount }, (_, colIndex) => (
                        <td key={colIndex} className="border border-border p-0">
                          <input
                            type="text"
                            className="w-full border-0 bg-background px-2 py-1.5 text-sm outline-none focus:bg-accent/20"
                            value={row[colIndex] ?? ""}
                            onChange={(event) =>
                              updateCell(rowIndex, colIndex, event.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="w-8 border-0 bg-transparent p-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Delete row"
                          disabled={data.rows.length <= 1}
                          onClick={() => deleteRow(rowIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.rows.length === 1 &&
            data.headers.every((h) => /^Column \d+$/.test(h)) &&
            data.rows[0].every((c) => !c.trim()) ? (
              <TableGridPicker onSelect={(rows, cols) => setData(initTableDraft(rows, cols, data.label))} />
            ) : null}
          </div>
        )}

        {isPendingApproval ? (
          <PendingApprovalChip
            className="mb-4"
            pendingSource={approvalDisplay.pendingSource ?? "human"}
            editedBy={approvalDisplay.editedBy}
            aiAssisted={approvalDisplay.aiAssisted}
            aiProvider={approvalDisplay.aiProvider}
            approvedBaseline={approvedBaseline}
            loadedContent={loaded}
            current={currentContent}
            onApprove={() => void handleApprove()}
            onDiscard={() => void handleDiscard()}
            approving={saveState === "saving"}
            approveLabel="Approve"
          />
        ) : null}

        <div className={cn("mt-6 border-t border-border pt-4", isPendingApproval && "rounded-md ring-1 ring-amber-500/30")}>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <MarkdownViewer markdown={previewMarkdown} className="text-sm" />
        </div>
      </div>
      </div>
    </div>
  );
}
