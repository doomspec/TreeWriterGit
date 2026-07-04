export type NodeKind = "section" | "subsection" | "unit" | "figure" | "table" | "equation";

/** Top-level paper folders managed in Assets, not the section outline. */
export const PAPER_ASSET_DIRS = new Set(["figures", "tables", "equations"]);

export const TEMP_NOTES_DOC = "temp-notes.md";

export class ModelFsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ModelFsError";
  }
}
