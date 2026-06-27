import { ApiError, getApiBaseUrl, request, requestText } from "@/lib/apiClient";

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
  return `${getApiBaseUrl()}/api/model/asset?path=${encodeURIComponent(relativePath)}`;
}

export function clearFigureCache(): void {
  figureCache.clear();
}

export async function fetchFigureMetadata(path: string): Promise<FigureMetadata | null> {
  const key = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (figureCache.has(key)) return figureCache.get(key) ?? null;

  try {
    const data = await request<FigureMetadata>(`/api/model/figure?path=${encodeURIComponent(key)}`);
    figureCache.set(key, data);
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      figureCache.set(key, null);
      return null;
    }
    throw err;
  }
}

export async function fetchPaperFigures(paperPath: string): Promise<FigureMetadata[]> {
  const data = await request<{ figures: FigureMetadata[] }>(
    `/api/model/figures?paper=${encodeURIComponent(paperPath)}`,
  );
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
  return requestText(`/api/model/asset?path=${encodeURIComponent(relativePath)}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadFigureImage(
  figurePath: string,
  file: File,
  role: "preview" | "source" | "both" | "auto" = "auto",
): Promise<FigureMetadata> {
  const key = figurePath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  figureCache.delete(key);

  const data = await fileToBase64(file);
  const result = await request<{ figure: FigureMetadata }>("/api/model/figure/upload", {
    method: "POST",
    body: JSON.stringify({
      path: key,
      filename: file.name,
      data,
      ...(role !== "auto" ? { role } : {}),
    }),
  });
  figureCache.set(key, result.figure);
  return result.figure;
}

export const FIGURE_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/svg+xml,image/gif,image/webp,application/pdf,.png,.jpg,.jpeg,.svg,.gif,.webp,.pdf";

const FIGURE_UPLOAD_PATTERN = /\.(png|jpe?g|svg|gif|webp|pdf)$/i;

export function isFigureUploadFile(file: File): boolean {
  if (FIGURE_UPLOAD_PATTERN.test(file.name)) return true;
  if (file.type === "application/pdf") return true;
  return /^image\//.test(file.type);
}
