import { useCallback, useEffect, useState } from "react";

import {
  fetchUnitSessions,
  patchUnitSession,
  type AgentSessionFile,
} from "@/lib/agentDispatchClient";

export function useDispatchSessions(unitPath: string, refreshVersion = 0) {
  const [sessions, setSessions] = useState<AgentSessionFile[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!unitPath) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      setSessions(await fetchUnitSessions(unitPath));
    } finally {
      setLoading(false);
    }
  }, [unitPath]);

  useEffect(() => {
    void reload();
  }, [reload, refreshVersion]);

  const markStatus = useCallback(
    async (session: AgentSessionFile, status: AgentSessionFile["status"]) => {
      if (!unitPath) return;
      try {
        await patchUnitSession({
          unitPath,
          filename: session.filename,
          status,
        });
        await reload();
      } catch {
        // non-fatal
      }
    },
    [reload, unitPath],
  );

  return { sessions, loading, reload, markStatus };
}
