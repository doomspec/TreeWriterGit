import { indexPathFor, parseIndexFrontmatter } from "@/lib/modelTree";
import { isApiTemporarilyOffline } from "@/lib/apiClient";
import { fetchModelFile } from "@/modelApi";

const inflight = new Map<string, Promise<string[]>>();

/** Load INDEX.md child_order for a folder; dedupes in-flight requests and skips when API is offline. */
export async function loadIndexChildOrder(folderPath: string): Promise<string[]> {
  if (!folderPath || isApiTemporarilyOffline()) return [];

  const existing = inflight.get(folderPath);
  if (existing) return existing;

  const promise = fetchModelFile(indexPathFor(folderPath))
    .then((data) => parseIndexFrontmatter(data.content).childOrder)
    .catch(() => [] as string[])
    .finally(() => {
      inflight.delete(folderPath);
    });

  inflight.set(folderPath, promise);
  return promise;
}
