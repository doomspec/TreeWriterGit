const STORAGE_KEY = "treewriter.lastAgentProvider.v1";

export function loadLastAgentProvider(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function saveLastAgentProvider(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // quota or private mode — ignore
  }
}

/** Prefer last-used provider when still configured; fall back to config default. */
export function resolveAgentProvider(configDefault: string, availableNames: string[]): string {
  const lastUsed = loadLastAgentProvider();
  if (lastUsed && availableNames.includes(lastUsed)) return lastUsed;
  if (availableNames.includes(configDefault)) return configDefault;
  return availableNames[0] ?? configDefault;
}
