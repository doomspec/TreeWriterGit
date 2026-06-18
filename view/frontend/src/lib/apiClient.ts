export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("<")) {
      throw new ApiError(
        `API returned HTML instead of JSON (${response.status}). Is the backend running at ${apiBaseUrl}?`,
        response.status,
      );
    }
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(`Invalid JSON from API (${response.status})`, response.status);
    }
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}
