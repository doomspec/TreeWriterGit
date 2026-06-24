import { useEffect, useState } from "react";

import { ApiError, claimPresence, fetchPresence, heartbeatPresence, releasePresence } from "@/modelApi";

function ignorePresenceError(): void {
  // Presence is best-effort; ignore network failures during heartbeat/unmount.
}

export function useEditorPresence(filePath: string, authorName: string) {
  const [otherEditor, setOtherEditor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let heartbeatTimer: number | undefined;

    const syncPresence = async () => {
      try {
        const { presence } = await fetchPresence(filePath);
        if (cancelled) return;
        if (presence && presence.user !== authorName) {
          setOtherEditor(presence.user);
          return;
        }
        try {
          await claimPresence(filePath, authorName);
          if (!cancelled) setOtherEditor(null);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            const retry = await fetchPresence(filePath);
            if (!cancelled && retry.presence) setOtherEditor(retry.presence.user);
          }
        }
      } catch {
        // presence is best-effort on localhost
      }
    };

    void syncPresence();
    heartbeatTimer = window.setInterval(() => {
      void heartbeatPresence(filePath, authorName).catch(ignorePresenceError);
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      void releasePresence(filePath, authorName).catch(ignorePresenceError);
    };
  }, [authorName, filePath]);

  return { otherEditor };
}
