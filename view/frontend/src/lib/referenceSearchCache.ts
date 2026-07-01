import { filterReferences } from "@/lib/assetSearch";
import { fetchCitedReferences, fetchReferenceIndex, type ReferenceMetadata } from "@/lib/paperAssets";

const cache = new Map<string, ReferenceMetadata[]>();
const inflight = new Map<string, Promise<ReferenceMetadata[]>>();

const citedCache = new Map<string, ReferenceMetadata[]>();
const citedInflight = new Map<string, Promise<ReferenceMetadata[]>>();

export function invalidateReferenceSearchCache(paperPath?: string): void {
  if (paperPath) {
    cache.delete(paperPath);
    inflight.delete(paperPath);
    citedCache.delete(paperPath);
    citedInflight.delete(paperPath);
    return;
  }
  cache.clear();
  inflight.clear();
  citedCache.clear();
  citedInflight.clear();
}

export async function ensureReferenceIndex(paperPath: string): Promise<ReferenceMetadata[]> {
  const cached = cache.get(paperPath);
  if (cached) return cached;

  const pending = inflight.get(paperPath);
  if (pending) return pending;

  const load = fetchReferenceIndex(paperPath)
    .then((references) => {
      cache.set(paperPath, references);
      inflight.delete(paperPath);
      return references;
    })
    .catch((err) => {
      inflight.delete(paperPath);
      throw err;
    });

  inflight.set(paperPath, load);
  return load;
}

export async function ensureCitedReferences(paperPath: string): Promise<ReferenceMetadata[]> {
  const cached = citedCache.get(paperPath);
  if (cached) return cached;

  const pending = citedInflight.get(paperPath);
  if (pending) return pending;

  const load = fetchCitedReferences(paperPath)
    .then((references) => {
      citedCache.set(paperPath, references);
      citedInflight.delete(paperPath);
      return references;
    })
    .catch((err) => {
      citedInflight.delete(paperPath);
      throw err;
    });

  citedInflight.set(paperPath, load);
  return load;
}

export function searchReferences(
  references: ReferenceMetadata[],
  query: string,
  limit = 20,
): ReferenceMetadata[] {
  return filterReferences(references, query).slice(0, limit);
}
