const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
  return `${apiBaseUrl}/api/model/asset?path=${encodeURIComponent(relativePath)}`;
}

export async function fetchEquationMetadata(path: string): Promise<EquationMetadata | null> {
  const key = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (equationCache.has(key)) return equationCache.get(key) ?? null;

  const res = await fetch(`${apiBaseUrl}/api/model/equation?path=${encodeURIComponent(key)}`);
  if (res.status === 404) {
    equationCache.set(key, null);
    return null;
  }
  if (!res.ok) throw new Error(`Equation load failed (${res.status})`);
  const data = (await res.json()) as EquationMetadata;
  equationCache.set(key, data);
  return data;
}

export async function fetchLatexSource(relativePath: string): Promise<string> {
  const res = await fetch(assetUrl(relativePath));
  if (!res.ok) throw new Error(`LaTeX source load failed (${res.status})`);
  return res.text();
}

export function equationTargetFromHref(href: string): string | null {
  if (href.startsWith("equation://")) return href.slice("equation://".length);
  return null;
}
