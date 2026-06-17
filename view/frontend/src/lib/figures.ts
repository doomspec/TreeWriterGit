const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type FigureMetadata = {
  kind: "figure-unit" | "figure-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  previewPath: string | null;
  sourcePath: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  figureLabel: string | null;
};

const figureCache = new Map<string, FigureMetadata | null>();

export function assetUrl(relativePath: string): string {
  return `${apiBaseUrl}/api/model/asset?path=${encodeURIComponent(relativePath)}`;
}

export function clearFigureCache(): void {
  figureCache.clear();
}

export async function fetchFigureMetadata(path: string): Promise<FigureMetadata | null> {
  const key = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (figureCache.has(key)) return figureCache.get(key) ?? null;

  const res = await fetch(`${apiBaseUrl}/api/model/figure?path=${encodeURIComponent(key)}`);
  if (res.status === 404) {
    figureCache.set(key, null);
    return null;
  }
  if (!res.ok) throw new Error(`Figure load failed (${res.status})`);
  const data = (await res.json()) as FigureMetadata;
  figureCache.set(key, data);
  return data;
}

export async function fetchPaperFigures(paperPath: string): Promise<FigureMetadata[]> {
  const res = await fetch(`${apiBaseUrl}/api/model/figures?paper=${encodeURIComponent(paperPath)}`);
  if (!res.ok) throw new Error(`Figures list failed (${res.status})`);
  const data = (await res.json()) as { figures: FigureMetadata[] };
  return data.figures;
}

export function resolveAssetSrc(src: string, linkContextPath: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("asset://")) {
    return assetUrl(src.slice("asset://".length));
  }
  const base = linkContextPath.includes("/")
    ? linkContextPath.slice(0, linkContextPath.lastIndexOf("/"))
    : linkContextPath;
  const relative = src.startsWith("/") ? src.slice(1) : src.includes("/") ? src : `${base}/${src}`;
  return assetUrl(relative);
}

export function figureTargetFromHref(href: string): string | null {
  if (href.startsWith("figure://")) return href.slice("figure://".length);
  return null;
}

export async function fetchMermaidSource(relativePath: string): Promise<string> {
  const res = await fetch(assetUrl(relativePath));
  if (!res.ok) throw new Error(`Mermaid source load failed (${res.status})`);
  return res.text();
}
