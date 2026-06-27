import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSectionCompose } from "@/lib/api/modelApi";

export function useSectionCompose(
  paperPath: string,
  onError: (message: string) => void,
  refreshVersion = 0,
) {
  const [compose, setCompose] = useState<Awaited<ReturnType<typeof fetchSectionCompose>> | null>(null);
  const [loading, setLoading] = useState(true);
  const hasComposeRef = useRef(false);

  const loadCompose = useCallback(
    (background = false) => {
      if (!background) setLoading(true);
      return fetchSectionCompose(paperPath)
        .then((data) => {
          setCompose(data);
          hasComposeRef.current = true;
          setLoading(false);
        })
        .catch((err) => {
          if (!hasComposeRef.current) setCompose(null);
          setLoading(false);
          onError(err instanceof Error ? err.message : String(err));
        });
    },
    [onError, paperPath],
  );

  useEffect(() => {
    hasComposeRef.current = false;
    setCompose(null);
    setLoading(true);
  }, [paperPath]);

  useEffect(() => {
    let cancelled = false;
    void loadCompose(hasComposeRef.current).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadCompose, paperPath, refreshVersion]);

  return { compose, loading, loadCompose, hasComposeRef };
}
