import { stripFrontmatter } from "@/lib/modelTree";

export type TableAlign = "left" | "center" | "right";

export type ParsedTableDraft = {
  label: string;
  caption: string;
  headers: string[];
  aligns: TableAlign[];
  rows: string[][];
};

const CAPTION_LINE =
  /^\*\*(.+?)\.\*\*(?:\s+_(.+?)_|\s+\*(.+?)\*|\s+([^_\n*]+))?\s*$/;

function parseAlignCell(cell: string): TableAlign {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

function alignCell(align: TableAlign): string {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return "---";
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

export function emptyTableDraft(label = "Table"): ParsedTableDraft {
  return {
    label,
    caption: "",
    headers: ["Column 1", "Column 2"],
    aligns: ["left", "left"],
    rows: [["", ""]],
  };
}

/** Parse table unit draft.md: caption line + GFM table. */
export function parseTableDraft(markdown: string, fallbackLabel = "Table"): ParsedTableDraft {
  const body = stripFrontmatter(markdown).trim();
  if (!body) return emptyTableDraft(fallbackLabel);

  const lines = body.split("\n");
  let label = fallbackLabel;
  let caption = "";
  let idx = 0;

  const captionMatch = lines[0]?.match(CAPTION_LINE);
  if (captionMatch) {
    label = captionMatch[1].trim();
    caption = (captionMatch[2] ?? captionMatch[3] ?? captionMatch[4] ?? "").trim();
    idx = 1;
  }

  while (idx < lines.length && !lines[idx]?.trim()) idx += 1;

  const tableLines: string[] = [];
  for (; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line.trim().startsWith("|")) tableLines.push(line);
    else if (tableLines.length > 0) break;
  }

  if (tableLines.length === 0) {
    return { label, caption, headers: ["Column 1", "Column 2"], aligns: ["left", "left"], rows: [[""]] };
  }

  const headerCells = splitTableRow(tableLines[0]);
  let aligns: TableAlign[] = headerCells.map(() => "left" as TableAlign);
  let dataStart = 1;

  if (tableLines[1]) {
    const sepCells = splitTableRow(tableLines[1]);
    if (isSeparatorRow(sepCells)) {
      aligns = sepCells.map(parseAlignCell);
      dataStart = 2;
    }
  }

  const colCount = Math.max(headerCells.length, aligns.length, 1);
  const headers = Array.from({ length: colCount }, (_, i) => headerCells[i] ?? "");
  const normalizedAligns = Array.from({ length: colCount }, (_, i) => aligns[i] ?? "left");

  const rows: string[][] = [];
  for (let r = dataStart; r < tableLines.length; r += 1) {
    const cells = splitTableRow(tableLines[r]);
    if (cells.length === 0) continue;
    rows.push(Array.from({ length: colCount }, (_, i) => cells[i] ?? ""));
  }

  if (rows.length === 0) {
    rows.push(Array.from({ length: colCount }, () => ""));
  }

  return { label, caption, headers, aligns: normalizedAligns, rows };
}

export function serializeTableDraft(data: ParsedTableDraft): string {
  const captionPart = data.caption.trim() ? ` _${data.caption.trim()}_` : "";
  const lines: string[] = [`**${data.label.trim()}.**${captionPart}`, ""];

  const colCount = Math.max(data.headers.length, data.aligns.length, ...data.rows.map((r) => r.length), 1);
  const headers = Array.from({ length: colCount }, (_, i) => data.headers[i] ?? "");
  const aligns = Array.from({ length: colCount }, (_, i) => data.aligns[i] ?? "left");

  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${aligns.map(alignCell).join(" | ")} |`);
  for (const row of data.rows) {
    const cells = Array.from({ length: colCount }, (_, i) => row[i] ?? "");
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function initTableDraft(rows: number, cols: number, label = "Table"): ParsedTableDraft {
  const headers = Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
  const aligns = Array.from({ length: cols }, () => "left" as TableAlign);
  const body = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  return { label, caption: "", headers, aligns, rows: body };
}
