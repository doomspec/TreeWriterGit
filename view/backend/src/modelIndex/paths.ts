import path from "node:path";

/** Repo-level derived index path; markdown under model/ stays source of truth. */
export function indexDbPathForModelRoot(modelRoot: string): string {
  const normalized = modelRoot.replace(/\\/g, "/");
  const base = normalized.endsWith("/model") ? path.dirname(modelRoot) : modelRoot;
  return path.join(base, ".treewriter", "index.sqlite");
}
