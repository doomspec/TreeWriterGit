import type { MarkdownFormatAction } from "@/lib/markdownFormat";

export function handleFormatShortcut(
  event: React.KeyboardEvent,
  onFormat: (action: MarkdownFormatAction) => void,
): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  const key = event.key.toLowerCase();
  if (key === "b") {
    event.preventDefault();
    onFormat("bold");
    return true;
  }
  if (key === "i") {
    event.preventDefault();
    onFormat("italic");
    return true;
  }
  return false;
}
