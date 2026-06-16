const STORAGE_KEY = "treewriter.userName";

export function getUserName(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("user");
    if (fromUrl?.trim()) {
      localStorage.setItem(STORAGE_KEY, fromUrl.trim());
      return fromUrl.trim();
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) return stored.trim();
  } catch {
    // private mode
  }
  return "Anonymous";
}

export function setUserName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name.trim() || "Anonymous");
  } catch {
    // ignore
  }
}
