import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer, resolveDefaultPaths } from "./appFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { repoRoot, modelRoot, terminalScriptPath } = resolveDefaultPaths(__dirname);

const port = Number(process.env.PORT ?? 4000);
const gitSyncIntervalMs = Number(process.env.GIT_SYNC_INTERVAL_MS ?? 120_000);
const gitSyncEnabled = process.env.GIT_SYNC_ENABLED !== "false";

const { close } = createServer(
  {
    repoRoot,
    modelRoot,
    terminalScriptPath,
  },
  port,
);

console.log(`TreeWriter backend listening on http://localhost:${port}`);
console.log(`Terminal working directory: ${modelRoot}`);
console.log(
  gitSyncEnabled
    ? `Git sync enabled every ${Math.round(gitSyncIntervalMs / 1000)}s`
    : "Git sync disabled",
);

process.on("SIGINT", () => {
  void close().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void close().then(() => process.exit(0));
});
