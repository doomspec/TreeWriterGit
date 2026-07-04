/** Known agent CLIs with a bridged (headless JSON) adapter on the backend. */
export const KNOWN_PROVIDERS = ["claude", "codex", "gemini", "hermes"] as const;

export type BridgedProvider = (typeof KNOWN_PROVIDERS)[number];

export function isBridgedProvider(provider: string): provider is BridgedProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(provider);
}
