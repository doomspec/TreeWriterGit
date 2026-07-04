import { useCallback, useEffect, useState } from "react";

import { fetchContributorsRegistry } from "@/lib/api/modelApi";
import type { ContributorsRegistry } from "@treewriter/shared";

const EMPTY_REGISTRY: ContributorsRegistry = { affiliations: [], authors: [] };

/** Load the global contributors library; refetch when refreshVersion bumps. */
export function useContributorsRegistry(options?: {
  enabled?: boolean;
  refreshVersion?: number;
  initialRegistry?: ContributorsRegistry;
}) {
  const skipFetch = options?.initialRegistry !== undefined;
  const enabled = (options?.enabled ?? true) && !skipFetch;
  const [registry, setRegistry] = useState<ContributorsRegistry>(
    options?.initialRegistry ?? EMPTY_REGISTRY,
  );
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = await fetchContributorsRegistry();
      setRegistry(next);
    } catch {
      setRegistry(EMPTY_REGISTRY);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (skipFetch) {
      setRegistry(options!.initialRegistry!);
      setLoading(false);
      return;
    }
    if (!enabled) return;
    void reload();
  }, [enabled, options?.initialRegistry, options?.refreshVersion, reload, skipFetch]);

  return { registry, loading, reload };
}
