import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export interface AiProvider {
  name: string;
  command: string;
  args: string[];
  writesFiles: boolean;
}

export interface ProviderConfig {
  aiProviders: AiProvider[];
  defaultProvider: string;
}

export const DEFAULT_PROVIDERS: AiProvider[] = [
  { name: "Claude Code", command: "claude", args: ["-p", "{prompt}"], writesFiles: true },
  { name: "Aider", command: "aider", args: ["--message", "{prompt}", "{files}"], writesFiles: true },
  {
    name: "Gemini",
    command: "gemini",
    args: ["-p", "{prompt}", "--approval-mode", "auto_edit"],
    writesFiles: true,
  },
];

/** CLIs that refuse to run when stdout is redirected (e.g. codex interactive mode). */
export const TTY_STDOUT_COMMANDS = new Set(["codex"]);

export const GEMINI_WORKSPACE_PREAMBLE = `IMPORTANT — TreeWriter workspace scope:
- Your shell cwd is the model/ directory (the manuscript tree).
- Every path in this task is relative to model/ (example: papers/my-paper/intro/draft.md).
- Read and write only under model/. Do not list or access the repository root or paths outside model/.

`;

export function isGeminiProvider(provider: AiProvider): boolean {
  return provider.command === "gemini";
}

export async function loadProviders(repoRoot: string): Promise<ProviderConfig> {
  const configPath = path.join(repoRoot, ".treewriter.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
    const providers = Array.isArray(parsed.aiProviders) && parsed.aiProviders.length > 0
      ? parsed.aiProviders
      : DEFAULT_PROVIDERS;
    return {
      aiProviders: providers,
      defaultProvider: parsed.defaultProvider ?? providers[0].name,
    };
  } catch {
    return { aiProviders: DEFAULT_PROVIDERS, defaultProvider: DEFAULT_PROVIDERS[0].name };
  }
}

export async function saveDefaultProvider(
  repoRoot: string,
  defaultProvider: string,
): Promise<ProviderConfig> {
  const name = defaultProvider.trim();
  if (!name) {
    throw new Error("defaultProvider is required");
  }
  const configPath = path.join(repoRoot, ".treewriter.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  const current = await loadProviders(repoRoot);
  if (!current.aiProviders.some((provider) => provider.name === name)) {
    throw new Error(`Unknown provider: ${name}`);
  }
  parsed.defaultProvider = name;
  if (!Array.isArray(parsed.aiProviders) || parsed.aiProviders.length === 0) {
    parsed.aiProviders = current.aiProviders;
  }
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return loadProviders(repoRoot);
}
