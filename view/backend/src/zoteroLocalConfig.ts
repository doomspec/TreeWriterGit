import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const DEFAULT_ZOTERO_LOCAL_BASE_URL = "http://127.0.0.1:23119/api";

export type ZoteroLocalConfig = {
  enabled: boolean;
  baseUrl: string;
};

const DEFAULT_CONFIG: ZoteroLocalConfig = {
  enabled: false,
  baseUrl: DEFAULT_ZOTERO_LOCAL_BASE_URL,
};

/** Allow only loopback hosts to prevent SSRF when proxying to Zotero. */
export function assertLocalZoteroBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("Invalid Zotero base URL");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("Zotero base URL must use localhost (127.0.0.1, localhost, or ::1)");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Zotero base URL must use http or https");
  }
  const normalized = parsed.toString().replace(/\/+$/, "");
  return normalized;
}

export function normalizeZoteroBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return DEFAULT_ZOTERO_LOCAL_BASE_URL;
  return assertLocalZoteroBaseUrl(raw);
}

export async function loadZoteroLocalConfig(repoRoot: string): Promise<ZoteroLocalConfig> {
  let config = { ...DEFAULT_CONFIG };
  try {
    const raw = await readFile(path.join(repoRoot, ".treewriter.json"), "utf8");
    const parsed = JSON.parse(raw) as { zoteroLocal?: Partial<ZoteroLocalConfig> };
    if (parsed.zoteroLocal && typeof parsed.zoteroLocal === "object") {
      const patch = parsed.zoteroLocal;
      if (typeof patch.enabled === "boolean") config.enabled = patch.enabled;
      if (typeof patch.baseUrl === "string" && patch.baseUrl.trim()) {
        config.baseUrl = normalizeZoteroBaseUrl(patch.baseUrl);
      }
    }
  } catch {
    // use defaults
  }
  return config;
}

export async function saveZoteroLocalPreferences(
  repoRoot: string,
  patch: Partial<Pick<ZoteroLocalConfig, "enabled" | "baseUrl">>,
): Promise<ZoteroLocalConfig> {
  const configPath = path.join(repoRoot, ".treewriter.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  const current = await loadZoteroLocalConfig(repoRoot);
  const next: ZoteroLocalConfig = {
    enabled: patch.enabled !== undefined ? patch.enabled : current.enabled,
    baseUrl:
      patch.baseUrl !== undefined ? normalizeZoteroBaseUrl(patch.baseUrl) : current.baseUrl,
  };
  parsed.zoteroLocal = next;
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return next;
}
