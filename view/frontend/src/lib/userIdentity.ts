const STORAGE_KEY = "treewriter.userName";
const GITHUB_HANDLE_KEY = "treewriter.githubHandle";

export function normalizeGitHubHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

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

/** GitHub handle used for draft edit/approval provenance (without @). */
export function getGitHubHandle(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("github");
    if (fromUrl?.trim()) {
      const handle = normalizeGitHubHandle(fromUrl);
      if (handle) {
        localStorage.setItem(GITHUB_HANDLE_KEY, handle);
        return handle;
      }
    }
    const stored = localStorage.getItem(GITHUB_HANDLE_KEY);
    if (stored?.trim()) return normalizeGitHubHandle(stored);
  } catch {
    // private mode
  }
  return "";
}

export function setGitHubHandle(handle: string): void {
  try {
    localStorage.setItem(GITHUB_HANDLE_KEY, normalizeGitHubHandle(handle));
  } catch {
    // ignore
  }
}

/** Preferred author for new comments: GitHub handle, then display name. */
export function getCommentAuthor(): string {
  const handle = getGitHubHandle()?.trim();
  if (handle) return handle;
  const name = getUserName();
  if (name && name !== "Anonymous") return name;
  return "";
}

export function hasCommentAuthorIdentity(): boolean {
  return Boolean(getCommentAuthor());
}
