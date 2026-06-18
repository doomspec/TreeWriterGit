import { ApiError, getApiBaseUrl, request, requestText } from "@/lib/apiClient";

export type EquationMetadata = {
  kind: "equation-unit" | "equation-note";
  path: string;
  title: string;
  caption: string;
  summary: string | null;
  sourcePath: string | null;
  outlinePath: string | null;
  draftPath: string | null;
  equationLabel: string | null;
};

const equationCache = new Map<string, EquationMetadata | null>();

export function assetUrl(relativePath: string): string {
  return `${getApiBaseUrl()}/api/model/asset?path=${encodeURIComponent(relativePath)}`;
}

export async function fetchEquationMetadata(path: string): Promise<EquationMetadata | null> {
  const key = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (equationCache.has(key)) return equationCache.get(key) ?? null;

  try {
    const data = await request<EquationMetadata>(`/api/model/equation?path=${encodeURIComponent(key)}`);
    equationCache.set(key, data);
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      equationCache.set(key, null);
      return null;
    }
    throw err;
  }
}

export async function fetchLatexSource(relativePath: string): Promise<string> {
  return requestText(`/api/model/asset?path=${encodeURIComponent(relativePath)}`);
}

export function equationTargetFromHref(href: string): string | null {
  if (href.startsWith("equation://")) return href.slice("equation://".length);
  return null;
}
