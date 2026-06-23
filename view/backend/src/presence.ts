import { ModelFsError } from "./modelFs.js";

const TTL_MS = 30_000;

interface PresenceClaim {
  user: string;
  since: string;
  lastSeen: number;
}

const activeEditors = new Map<string, PresenceClaim>();

function normalizePath(relativePath: string): string {
  return relativePath.split("\\").join("/").replace(/^\.\//, "");
}

function purgeStale(): void {
  const now = Date.now();
  for (const [filePath, claim] of activeEditors) {
    if (now - claim.lastSeen > TTL_MS) activeEditors.delete(filePath);
  }
}

export interface PresenceInfo {
  user: string;
  since: string;
}

/** Claim edit lock. Returns conflicting editor if another user holds the path. */
export function claimPresence(
  filePath: string,
  user: string,
): PresenceInfo | null {
  const normalized = normalizePath(filePath);
  if (!normalized) throw new ModelFsError("path required", 400);
  if (!user.trim()) throw new ModelFsError("user required", 400);

  purgeStale();
  const existing = activeEditors.get(normalized);
  const trimmedUser = user.trim();

  if (existing && existing.user !== trimmedUser) {
    return { user: existing.user, since: existing.since };
  }

  const now = Date.now();
  activeEditors.set(normalized, {
    user: trimmedUser,
    since: existing?.since ?? new Date(now).toISOString(),
    lastSeen: now,
  });
  return null;
}

export function releasePresence(filePath: string, user: string): void {
  const normalized = normalizePath(filePath);
  const existing = activeEditors.get(normalized);
  if (existing?.user === user.trim()) activeEditors.delete(normalized);
}

export function getPresence(filePath: string): PresenceInfo | null {
  purgeStale();
  const existing = activeEditors.get(normalizePath(filePath));
  if (!existing) return null;
  return { user: existing.user, since: existing.since };
}

export function heartbeatPresence(filePath: string, user: string): boolean {
  purgeStale();
  const normalized = normalizePath(filePath);
  const existing = activeEditors.get(normalized);
  if (existing?.user !== user.trim()) return false;
  existing.lastSeen = Date.now();
  return true;
}

export function resetPresenceState(): void {
  activeEditors.clear();
}

/** @deprecated use resetPresenceState */
export const resetPresenceForTests = resetPresenceState;
