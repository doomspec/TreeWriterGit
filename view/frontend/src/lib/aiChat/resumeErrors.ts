/** True when a bridged turn failed likely because the provider session id is stale. */
export function isBridgedResumeError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("resume") ||
    lower.includes("session expired") ||
    lower.includes("session not found") ||
    lower.includes("invalid session") ||
    lower.includes("unknown session")
  );
}
