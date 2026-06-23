import path from "node:path";
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { promisify } from "node:util";

import { readIndexData, toRelative } from "./modelFs.js";

const execFileAsync = promisify(execFile);

export type ModelNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  /** From INDEX.md frontmatter when present. */
  kind?: string;
  children?: ModelNode[];
};

export async function readModelTree(modelRoot: string, directory = modelRoot): Promise<ModelNode[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = toRelative(modelRoot, absolutePath);

        if (entry.isDirectory()) {
          const indexData = await readIndexData(modelRoot, relativePath);
          const kind = typeof indexData.kind === "string" ? indexData.kind : undefined;
          return {
            name: entry.name,
            path: relativePath,
            type: "directory" as const,
            kind,
            children: await readModelTree(modelRoot, absolutePath),
          };
        }

        return {
          name: entry.name,
          path: relativePath,
          type: "file" as const,
        };
      }),
  );

  return nodes;
}
