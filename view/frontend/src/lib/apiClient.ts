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

const API_OFFLINE_BASE_MS = 5_000;
const API_OFFLINE_MAX_MS = 60_000;
let apiOfflineUntil = 0;
let apiOfflineBackoffMs = API_OFFLINE_BASE_MS;

export function isApiTemporarilyOffline(): boolean {
  return Date.now() < apiOfflineUntil;
}

function markApiOnline(): void {
  apiOfflineUntil = 0;
  apiOfflineBackoffMs = API_OFFLINE_BASE_MS;
}

function markApiOffline(): void {
  apiOfflineUntil = Date.now() + apiOfflineBackoffMs;
  apiOfflineBackoffMs = Math.min(API_OFFLINE_MAX_MS, apiOfflineBackoffMs * 2);
}

function offlineApiError(): ApiError {
  return new ApiError(
    `Cannot reach API at ${getApiBaseUrl()}. Is the backend running?`,
    0,
  );
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (isApiTemporarilyOffline()) {
    throw offlineApiError();
  }

  const apiBaseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    markApiOffline();
    throw offlineApiError();
  }

  markApiOnline();
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

export async function requestText(path: string, init?: RequestInit): Promise<string> {
  if (isApiTemporarilyOffline()) {
    throw offlineApiError();
  }

  const apiBaseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init);
  } catch {
    markApiOffline();
    throw offlineApiError();
  }

  markApiOnline();
  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }
  return response.text();
}
