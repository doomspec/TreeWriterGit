import { importMainBibtex } from "./bibLibrary.js";
import { parseBibtex } from "./bibtexImport.js";
import type { ZoteroLocalConfig } from "./zoteroLocalConfig.js";

export type ZoteroSearchHit = {
  itemKey: string;
  title: string;
  authors: string | null;
  year: string | null;
  doi: string | null;
  citeKey: string | null;
  itemType: string | null;
};

export type ZoteroImportResult = {
  created: string[];
  skipped: string[];
  errors: string[];
  citeKeys: string[];
};

type ZoteroCreator = {
  creatorType?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

type ZoteroItemJson = {
  key?: string;
  data?: {
    title?: string;
    creators?: ZoteroCreator[];
    date?: string;
    DOI?: string;
    extra?: string;
    itemType?: string;
  };
};

function libraryBase(config: ZoteroLocalConfig): string {
  return `${config.baseUrl.replace(/\/+$/, "")}/users/0`;
}

function formatCreators(creators: ZoteroCreator[] | undefined): string | null {
  if (!creators?.length) return null;
  const names = creators
    .map((creator) => {
      if (creator.name?.trim()) return creator.name.trim();
      const parts = [creator.lastName, creator.firstName].filter(Boolean);
      return parts.join(", ").trim();
    })
    .filter(Boolean);
  return names.length > 0 ? names.join("; ") : null;
}

function extractYear(date: string | undefined): string | null {
  if (!date?.trim()) return null;
  const match = date.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? null;
}

/** Parse Better BibTeX citation key from Zotero extra field. */
export function extractBbtCiteKey(extra: string | undefined): string | null {
  if (!extra?.trim()) return null;
  const citationKey = extra.match(/(?:^|\n)\s*(?:Citation Key|bibtex:\s*Citation Key)\s*:\s*(\S+)/i);
  if (citationKey?.[1]) return citationKey[1].replace(/[,{}]/g, "").trim() || null;
  const bibtexLine = extra.match(/(?:^|\n)\s*bibtex:\s*(\S+)/i);
  if (bibtexLine?.[1]) return bibtexLine[1].replace(/[,{}]/g, "").trim() || null;
  return null;
}

export function normalizeZoteroItem(item: ZoteroItemJson): ZoteroSearchHit | null {
  const itemKey = item.key?.trim();
  if (!itemKey) return null;
  const data = item.data ?? {};
  const title = data.title?.trim() || "(untitled)";
  return {
    itemKey,
    title,
    authors: formatCreators(data.creators),
    year: extractYear(data.date),
    doi: data.DOI?.trim() || null,
    citeKey: extractBbtCiteKey(data.extra),
    itemType: data.itemType?.trim() || null,
  };
}

async function zoteroFetch(
  config: ZoteroLocalConfig,
  pathname: string,
  params: Record<string, string> = {},
): Promise<Response> {
  const url = new URL(`${libraryBase(config)}${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return fetch(url, {
    headers: { "Zotero-API-Version": "3" },
    signal: AbortSignal.timeout(8000),
  });
}

export async function pingZoteroLocal(config: ZoteroLocalConfig): Promise<boolean> {
  try {
    const response = await zoteroFetch(config, "/items", { limit: "1", format: "json" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function searchZoteroLocal(
  config: ZoteroLocalConfig,
  query: string,
  limit = 20,
): Promise<ZoteroSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const response = await zoteroFetch(config, "/items", {
    q,
    limit: String(Math.min(Math.max(limit, 1), 50)),
    format: "json",
    itemType: "-attachment || -note",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zotero search failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const items = (await response.json()) as ZoteroItemJson[];
  if (!Array.isArray(items)) return [];
  const hits: ZoteroSearchHit[] = [];
  for (const item of items) {
    const normalized = normalizeZoteroItem(item);
    if (normalized) hits.push(normalized);
  }
  return hits;
}

export async function exportZoteroItemsBibtex(
  config: ZoteroLocalConfig,
  itemKeys: string[],
): Promise<string> {
  const keys = [...new Set(itemKeys.map((key) => key.trim()).filter(Boolean))];
  if (keys.length === 0) return "";
  const response = await zoteroFetch(config, "/items", {
    itemKey: keys.join(","),
    format: "bibtex",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zotero BibTeX export failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return response.text();
}

function citeKeysFromBibtex(bibtex: string): string[] {
  return parseBibtex(bibtex)
    .map((entry) => entry.citeKey)
    .filter(Boolean);
}

export async function importZoteroItemsToMainBib(
  modelRoot: string,
  config: ZoteroLocalConfig,
  itemKeys: string[],
): Promise<ZoteroImportResult> {
  const keys = [...new Set(itemKeys.map((key) => key.trim()).filter(Boolean))];
  if (keys.length === 0) {
    return { created: [], skipped: [], errors: ["No item keys provided"], citeKeys: [] };
  }
  const bibtex = await exportZoteroItemsBibtex(config, keys);
  if (!bibtex.trim()) {
    return { created: [], skipped: [], errors: ["Zotero returned empty BibTeX"], citeKeys: [] };
  }
  const result = await importMainBibtex(modelRoot, bibtex);
  const citeKeys = [
    ...new Set([...result.created, ...result.skipped, ...citeKeysFromBibtex(bibtex)]),
  ];
  return { ...result, citeKeys };
}
