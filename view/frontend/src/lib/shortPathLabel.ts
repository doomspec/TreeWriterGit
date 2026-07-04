import { paperSlugFromPath } from "@/components/nav/PaperSelect";

/** Last two path segments, prefixed with ellipsis when deeper. */
export function shortPathLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
}

/** Label for paper-wide chat history scope in the context pointer. */
export function paperHistoryScopeLabel(path: string): string {
  const slug = paperSlugFromPath(path);
  return slug ? `${slug} · all sections` : "Paper history";
}
