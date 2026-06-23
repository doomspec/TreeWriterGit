export function isEditorUndoShortcut(event: React.KeyboardEvent | KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && key === "z";
}

export function isEditorRedoShortcut(event: React.KeyboardEvent | KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  return (event.metaKey || event.ctrlKey) && event.shiftKey && key === "z";
}

export function handleEditorUndoRedoShortcuts(
  event: React.KeyboardEvent | KeyboardEvent,
  handlers: { undo: () => void; redo: () => void },
): boolean {
  if (isEditorUndoShortcut(event)) {
    event.preventDefault();
    handlers.undo();
    return true;
  }
  if (isEditorRedoShortcut(event)) {
    event.preventDefault();
    handlers.redo();
    return true;
  }
  return false;
}
