const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type NodeKind = "section" | "subsection" | "unit";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function createNode(parent: string, name: string, kind: NodeKind) {
  return request<{ ok: true; path: string; kind: NodeKind }>("/api/model/node", {
    method: "POST",
    body: JSON.stringify({ parent, name, kind })
  });
}

export function createFile(path: string, content = "") {
  return request<{ ok: true; path: string }>("/api/model/file", {
    method: "POST",
    body: JSON.stringify({ path, content })
  });
}

export function deleteNode(path: string, recursive = false) {
  const query = recursive ? "&recursive=true" : "";
  return request<{ ok: true; path: string }>(
    `/api/model/file?path=${encodeURIComponent(path)}${query}`,
    { method: "DELETE" }
  );
}

export function moveNode(from: string, to: string) {
  return request<{ ok: true; from: string; to: string }>("/api/model/move", {
    method: "POST",
    body: JSON.stringify({ from, to })
  });
}

export function reorderChildren(parent: string, childOrder: string[]) {
  return request<{ ok: true; parent: string }>("/api/model/reorder", {
    method: "POST",
    body: JSON.stringify({ parent, child_order: childOrder })
  });
}
