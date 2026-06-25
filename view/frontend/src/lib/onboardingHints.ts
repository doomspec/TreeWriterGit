const NOTES_PANE_HINT_KEY = "treewriter.hint.notesPane.v1";

export function isNotesPaneHintDismissed(): boolean {
  try {
    return localStorage.getItem(NOTES_PANE_HINT_KEY) === "true";
  } catch {
    return true;
  }
}

export function dismissNotesPaneHint(): void {
  try {
    localStorage.setItem(NOTES_PANE_HINT_KEY, "true");
  } catch {
    // ignore quota / private mode
  }
}
