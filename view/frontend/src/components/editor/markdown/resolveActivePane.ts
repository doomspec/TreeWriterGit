export type ActivePaneTarget = "preview" | "source";

export function resolveActivePane(options: {
  targetPane?: ActivePaneTarget;
  previewEl: HTMLTextAreaElement | null;
  sourceEl: HTMLTextAreaElement | null;
  renderedEditable: boolean;
  showPreview: boolean;
  showSource: boolean;
}): { usePreview: boolean; target: HTMLTextAreaElement | null } {
  const { targetPane, previewEl, sourceEl, renderedEditable, showPreview, showSource } = options;

  let usePreview: boolean;
  if (targetPane === "preview") {
    usePreview = true;
  } else if (targetPane === "source") {
    usePreview = false;
  } else {
    usePreview = Boolean(
      previewEl &&
        renderedEditable &&
        (document.activeElement === previewEl || (showPreview && !showSource)),
    );
  }

  const target = usePreview && previewEl ? previewEl : sourceEl;
  return { usePreview, target };
}
