import { invalidateGraphCache, invalidateGraphCacheForChange } from "./graphCache.js";

type BroadcastSource = "api" | "watch";

const WATCH_DEDUPE_MS = 2_500;
let lastApiBroadcast: { path: string; at: number } | null = null;

/** Content-only saves should not rebuild the link graph on every keystroke. */
export type ModelEventKind = "structure" | "content" | "comments";

let treeVersion = 0;

export function inferModelEventKind(path: string | null | undefined): ModelEventKind {
  if (!path) return "structure";
  const normalized = path.replace(/\\/g, "/");
  if (normalized.endsWith("/draft.md") || normalized.endsWith("/outline.md")) {
    return "content";
  }
  return "structure";
}

export function enrichModelEvent(event: Record<string, unknown>): Record<string, unknown> {
  const path = typeof event.path === "string" ? event.path : null;
  const kind =
    event.kind === "structure" || event.kind === "content" || event.kind === "comments"
      ? event.kind
      : event.type === "comments-changed"
        ? "comments"
        : inferModelEventKind(path);
  if (kind === "structure") {
    treeVersion += 1;
  }
  return { ...event, kind, treeVersion };
}

export function getModelTreeVersion(): number {
  return treeVersion;
}

/** Content-only saves should not rebuild the link graph on every keystroke. */
export function changeAffectsGraph(path: string | null): boolean {
  if (!path) return true;
  const normalized = path.replace(/\\/g, "/");
  if (normalized.endsWith("/draft.md") || normalized.endsWith("/draft.approved.md")) {
    return false;
  }
  if (normalized.includes("/notes/sessions/")) {
    return false;
  }
  return true;
}

function isDuplicateWatchEvent(path: string | null): boolean {
  if (!path || !lastApiBroadcast) return false;
  if (lastApiBroadcast.path !== path) return false;
  return Date.now() - lastApiBroadcast.at < WATCH_DEDUPE_MS;
}

export type ModelEventBroadcaster = (
  event: Record<string, unknown>,
  source?: BroadcastSource,
) => void;

export function createModelEventBroadcaster(
  clients: Set<{ readyState: number; send: (data: string) => void }>,
  openState: number,
): ModelEventBroadcaster {
  return (event, source = "api") => {
    const enriched = enrichModelEvent(event);
    const path = typeof enriched.path === "string" ? enriched.path : null;

    if (source === "watch" && isDuplicateWatchEvent(path)) {
      return;
    }

    if (source === "api" && path) {
      lastApiBroadcast = { path, at: Date.now() };
    }

    if (changeAffectsGraph(path)) {
      invalidateGraphCacheForChange(path);
    }

    const payload = JSON.stringify({
      ...enriched,
      at: new Date().toISOString(),
    });

    for (const client of clients) {
      if (client.readyState === openState) {
        client.send(payload);
      }
    }
  };
}

export function resetModelEventBroadcastState(): void {
  lastApiBroadcast = null;
  treeVersion = 0;
  invalidateGraphCache();
}
