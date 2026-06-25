import { isTempNotesPath } from "@/lib/modelPaths";

/** Shown in the notes editor until the user adds their own content. */
export const TEMP_NOTES_EDITOR_PLACEHOLDER =
  "Scratchpad — not exported; no approval required.";

const PLACEHOLDER_PHRASE = "scratchpad — not exported; no approval required";

function normalizeTempNotesBody(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/[*_\\]/g, "")
    .toLowerCase();
}

/** True when disk content is empty or still the default temp-notes skeleton. */
export function isTempNotesPlaceholderContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;

  const lines = trimmed.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return true;

  if (lines.length === 1 && /^#\s+notes$/i.test(lines[0] ?? "")) {
    return true;
  }

  if (/^#\s+notes$/i.test(lines[0] ?? "")) {
    const rest = normalizeTempNotesBody(lines.slice(1).join("\n"));
    if (!rest || rest.includes(PLACEHOLDER_PHRASE)) {
      return true;
    }
  }

  return false;
}

/** Strip skeleton/placeholder content before loading into the editor. */
export function tempNotesContentForEditor(diskContent: string): string {
  return isTempNotesPlaceholderContent(diskContent) ? "" : diskContent;
}

export function normalizeLoadedContentForPath(filePath: string, diskContent: string): string {
  if (!isTempNotesPath(filePath)) return diskContent;
  return tempNotesContentForEditor(diskContent);
}
