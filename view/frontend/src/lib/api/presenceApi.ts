import { request } from "@/lib/apiClient";

export function claimPresence(filePath: string, user: string) {
  return request<{ ok: true }>("/api/presence/claim", {
    method: "POST",
    body: JSON.stringify({ path: filePath, user }),
  });
}

export function releasePresence(filePath: string, user: string) {
  return request<{ ok: true }>(
    `/api/presence/claim?path=${encodeURIComponent(filePath)}&user=${encodeURIComponent(user)}`,
    { method: "DELETE" },
  );
}

export function heartbeatPresence(filePath: string, user: string) {
  return request<{ ok: boolean }>("/api/presence/heartbeat", {
    method: "POST",
    body: JSON.stringify({ path: filePath, user }),
  });
}

export function fetchPresence(filePath: string) {
  return request<{ presence: { user: string; since: string } | null }>(
    `/api/presence?path=${encodeURIComponent(filePath)}`,
  );
}
