import { CodeFileEditor } from "@/components/explorer/CodeFileEditor";
import { ExplorerCsvGrid } from "@/components/explorer/viewers/ExplorerCsvGrid";
import { ExplorerDocxViewer } from "@/components/explorer/viewers/ExplorerDocxViewer";
import { ExplorerImageViewer } from "@/components/explorer/viewers/ExplorerImageViewer";
import { ExplorerMarkdownEditor } from "@/components/explorer/viewers/ExplorerMarkdownEditor";
import { ExplorerPdfViewer } from "@/components/explorer/viewers/ExplorerPdfViewer";
import { ExplorerXlsxViewer } from "@/components/explorer/viewers/ExplorerXlsxViewer";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "svg", "gif", "webp"]);

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

type ExplorerFileViewerProps = {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
};

/** Picks the right Explorer viewer/editor for a file by extension; falls back to the plain CodeMirror editor. */
export function ExplorerFileViewer(props: ExplorerFileViewerProps) {
  const ext = extensionOf(props.path);

  if (ext === "md" || ext === "markdown") return <ExplorerMarkdownEditor {...props} />;
  if (ext === "csv") return <ExplorerCsvGrid {...props} />;
  if (ext === "xlsx" || ext === "xls") return <ExplorerXlsxViewer {...props} />;
  if (ext === "pdf") return <ExplorerPdfViewer {...props} />;
  if (IMAGE_EXTENSIONS.has(ext)) return <ExplorerImageViewer {...props} />;
  if (ext === "docx") return <ExplorerDocxViewer {...props} />;
  return <CodeFileEditor {...props} />;
}
