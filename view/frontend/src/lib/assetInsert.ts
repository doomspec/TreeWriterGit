/** Paper root path from any model path, e.g. `papers/roboculture/results/draft.md` → `papers/roboculture`. */
export function paperPathFromModelPath(modelPath: string): string | null {
  const match = modelPath.match(/^(papers\/[^/]+)/);
  return match?.[1] ?? null;
}

export function defaultFigureInsertMode(filePath: string): "embed" | "link" {
  return filePath.endsWith("/draft.md") ? "embed" : "link";
}

export function figureInsertSnippet(path: string, title: string, mode: "embed" | "link"): string {
  if (mode === "embed") {
    return `\n::figure[${path}]\n\n`;
  }
  return `[[${path}|${title}]]`;
}

export function tableInsertSnippet(path: string, title: string): string {
  return `[[${path}|${title}]]`;
}

export function referenceInsertSnippet(citeKey: string): string {
  return `[@${citeKey}]`;
}
